import SyncService from './sync.service.js';
import { syncPullSchema, syncPushSchema } from './sync.schemas.js';

export class SyncController {
  static async pullUpdates(req, res, next) {
    try {
      const validated = syncPullSchema.parse(req.query);
      const updates = await SyncService.pullUpdates(validated);
      return res.status(200).json({ success: true, data: updates });
    } catch (err) {
      next(err);
    }
  }

  static async pushBatchedDrafts(req, res, next) {
    try {
      const validated = syncPushSchema.parse(req.body);
      const report = await SyncService.pushBatchedDrafts(validated, req.user);
      return res.status(200).json({ success: true, data: report });
    } catch (err) {
      next(err);
    }
  }
}

export default SyncController;