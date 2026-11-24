import prisma from '../src/utils/prisma.js';
import AgentManagementService from '../src/modules/field-operations/agent-management.service.js';

async function test() {
  console.log('Testing Agent Management Service...');

  // Find Kaloum chef and Matoto chef
  const chefKaloum = await prisma.user.findFirst({
    where: { email: 'chef.kaloum@aotuc.test' },
    include: { roles: { include: { role: true } } },
  });
  chefKaloum.roles = chefKaloum.roles.map(r => r.role.name);

  const chefMatoto = await prisma.user.findFirst({
    where: { email: 'chef.matoto@aotuc.test' },
    include: { roles: { include: { role: true } } },
  });
  chefMatoto.roles = chefMatoto.roles.map(r => r.role.name);

  const superAdmin = await prisma.user.findFirst({
    where: { email: 'superadmin@aotuc.test' },
    include: { roles: { include: { role: true } } },
  });
  superAdmin.roles = superAdmin.roles.map(r => r.role.name);

  console.log(`Chef Kaloum commune: ${chefKaloum.communeId}`);
  console.log(`Chef Matoto commune: ${chefMatoto.communeId}`);

  // Test 1: Chef Kaloum tries to create agent in Matoto -> MUST FAIL
  try {
    await AgentManagementService.createAgent(chefKaloum, {
      firstName: 'Test',
      lastName: 'Agent',
      phoneNumber: '+224629999001',
      communeId: chefMatoto.communeId,
    });
    console.error('FAIL: Chef Kaloum should NOT be allowed to create agent in Matoto');
  } catch (err) {
    console.log('SUCCESS: Prevented cross-commune agent creation:', err.message);
  }

  // Clean up any previous test agent
  await prisma.userRole.deleteMany({ where: { user: { phoneNumber: '+224629999002' } } });
  await prisma.auditLog.deleteMany({ where: { actor: { phoneNumber: '+224629999002' } } });
  await prisma.user.deleteMany({ where: { phoneNumber: '+224629999002' } });

  // Test 2: Chef Kaloum creates agent in Kaloum -> MUST SUCCEED
  const res = await AgentManagementService.createAgent(chefKaloum, {
    firstName: 'Agent',
    lastName: 'KaloumTest',
    phoneNumber: '+224629999002',
    address: 'Boulevard du Commerce, Kaloum',
  });
  console.log('SUCCESS: Created agent in Kaloum:', res.agent.employeeNumber, res.agent.id);

  // Test 3: Chef Matoto tries to view or update Kaloum agent -> MUST FAIL
  try {
    await AgentManagementService.getAgentById(chefMatoto, res.agent.id);
    console.error('FAIL: Chef Matoto should NOT be able to view Kaloum agent');
  } catch (err) {
    console.log('SUCCESS: Prevented cross-commune agent view:', err.message);
  }

  // Test 4: Chef Kaloum suspends the agent -> MUST SUCCEED
  const suspended = await AgentManagementService.updateAgentStatus(chefKaloum, res.agent.id, {
    status: 'SUSPENDED',
    reason: 'Suspension temporaire pour test',
  });
  console.log(`SUCCESS: Agent status is ${suspended.accountStatus}, isActive=${suspended.isActive}`);

  // Clean up test agent
  await prisma.auditLog.deleteMany({ where: { targetRecordId: res.agent.id } });
  await prisma.userRole.deleteMany({ where: { userId: res.agent.id } });
  await prisma.user.delete({ where: { id: res.agent.id } });
  console.log('Cleaned up test agent successfully.');
}

test().catch(console.error).finally(() => prisma.$disconnect());
