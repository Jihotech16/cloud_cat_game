import UIKit
import Capacitor
import FirebaseCore
import FirebaseAppCheck

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // App Check 제공업체는 FirebaseApp.configure() 보다 먼저 지정해야 한다.
        // capacitor-firebase-app-check 플러그인은 인스턴스가 만들어질 때
        // configure() 를 부르고 그 뒤에 팩토리를 설정하는데, 그 순서로는 이미
        // 기본 제공업체(DeviceCheck)로 초기화된 뒤라 App Attest 가 적용되지 않는다
        // (실기기 로그에서 exchangeDeviceCheckToken 호출로 확인).
        // 그래서 여기서 팩토리를 먼저 심고 configure() 를 직접 호출한다.
        #if DEBUG
        // 개발 빌드에서는 App Attest 가 Apple 서버 검증을 통과하지 못한다
        // (App Attest 는 App Store/TestFlight 빌드의 production 환경에서만 유효).
        // 그래서 디버그 제공업체를 쓴다. 실행 시 콘솔에 찍히는 디버그 토큰을
        // Firebase 콘솔 > App Check > 앱 > 디버그 토큰 관리에 등록하면
        // 개발 중에도 실제 토큰 흐름을 그대로 검증할 수 있다.
        AppCheck.setAppCheckProviderFactory(AppCheckDebugProviderFactory())
        #else
        AppCheck.setAppCheckProviderFactory(PoingAppCheckProviderFactory())
        #endif
        FirebaseApp.configure()
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}

// iOS 14 이상은 App Attest, 그 아래는 DeviceCheck 로 증명한다.
final class PoingAppCheckProviderFactory: NSObject, AppCheckProviderFactory {
    func createProvider(with app: FirebaseApp) -> AppCheckProvider? {
        if #available(iOS 14.0, *) {
            return AppAttestProvider(app: app)
        }
        return DeviceCheckProvider(app: app)
    }
}
