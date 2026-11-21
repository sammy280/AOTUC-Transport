package gn.gov.aotuc.aotuc_mobile

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationManager
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    private val channelName = "gn.gov.aotuc/location"
    private val permissionRequestCode = 4021
    private var pendingResult: MethodChannel.Result? = null

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, channelName)
            .setMethodCallHandler { call, result ->
                if (call.method == "getCurrentLocation") {
                    handleGetLocation(result)
                } else {
                    result.notImplemented()
                }
            }
    }

    private fun handleGetLocation(result: MethodChannel.Result) {
        val fineGranted = ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        val coarseGranted = ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED

        if (!fineGranted && !coarseGranted) {
            pendingResult = result
            ActivityCompat.requestPermissions(
                this,
                arrayOf(
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
                ),
                permissionRequestCode
            )
            return
        }

        resolveCurrentFix(result)
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == permissionRequestCode) {
            val res = pendingResult ?: return
            pendingResult = null
            val granted = grantResults.isNotEmpty() &&
                grantResults.any { it == PackageManager.PERMISSION_GRANTED }
            if (granted) {
                resolveCurrentFix(res)
            } else {
                res.success(
                    mapOf(
                        "status" to "PERMISSION_DENIED",
                        "message" to "Permission de localisation refusée sur l'appareil."
                    )
                )
            }
        }
    }

    @Suppress("MissingPermission")
    private fun resolveCurrentFix(result: MethodChannel.Result) {
        try {
            val locationManager = getSystemService(Context.LOCATION_SERVICE) as LocationManager
            val gpsEnabled = locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)
            val netEnabled = locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)

            if (!gpsEnabled && !netEnabled) {
                result.success(
                    mapOf(
                        "status" to "GPS_DISABLED",
                        "message" to "Le service GPS est désactivé sur cet appareil."
                    )
                )
                return
            }

            var bestLocation: Location? = null
            if (gpsEnabled) {
                bestLocation = locationManager.getLastKnownLocation(LocationManager.GPS_PROVIDER)
            }
            if (bestLocation == null && netEnabled) {
                bestLocation = locationManager.getLastKnownLocation(LocationManager.NETWORK_PROVIDER)
            }

            if (bestLocation != null) {
                result.success(
                    mapOf(
                        "status" to "OK",
                        "latitude" to bestLocation.latitude,
                        "longitude" to bestLocation.longitude,
                        "timestamp" to bestLocation.time
                    )
                )
            } else {
                result.success(
                    mapOf(
                        "status" to "NO_FIX",
                        "message" to "Signal GPS indisponible en intérieur (aucune coordonnée verrouillée)."
                    )
                )
            }
        } catch (e: Exception) {
            result.success(
                mapOf(
                    "status" to "ERROR",
                    "message" to (e.message ?: "Erreur matérielle GPS")
                )
            )
        }
    }
}
