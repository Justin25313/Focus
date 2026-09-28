import UIKit
import WebKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?
  var websiteDataJanitor: WebsiteDataJanitor?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let janitor = WebsiteDataJanitor()
    janitor.start()
    websiteDataJanitor = janitor

    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    window = UIWindow(frame: UIScreen.main.bounds)

    factory.startReactNative(
      withModuleName: "Focus",
      in: window,
      launchOptions: launchOptions
    )

    return true
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}

/// Clears the persistent WKWebsiteDataStore (cookies, cache, storage) when
/// the JS side asks for it. JS writes `FocusClearWebsiteDataRequest = true`
/// to NSUserDefaults via React Native's `Settings` API; when the data is
/// gone we write `FocusClearWebsiteDataDoneAt`, which JS is watching.
/// This avoids a custom native module while keeping cookie removal native
/// (Instagram's session cookie is HttpOnly and unreachable from JS).
/// With `FocusClearWebsiteDataDomains` set, only those sites are cleared
/// (e.g. "Abmelden" for one app); without it, everything.
@MainActor
final class WebsiteDataJanitor {
  static let requestKey = "FocusClearWebsiteDataRequest"
  static let doneKey = "FocusClearWebsiteDataDoneAt"
  static let domainsKey = "FocusClearWebsiteDataDomains"

  private var observer: NSObjectProtocol?
  private var inProgress = false

  func start() {
    observer = NotificationCenter.default.addObserver(
      forName: UserDefaults.didChangeNotification,
      object: nil,
      queue: .main
    ) { [weak self] _ in
      Task { @MainActor in
        self?.clearIfRequested()
      }
    }
    // Finish a request that was interrupted by the app being killed.
    clearIfRequested()
  }

  private func clearIfRequested() {
    guard !inProgress, UserDefaults.standard.bool(forKey: Self.requestKey) else { return }
    inProgress = true

    let domains = UserDefaults.standard.stringArray(forKey: Self.domainsKey) ?? []

    Task { @MainActor in
      let store = WKWebsiteDataStore.default()
      let types = WKWebsiteDataStore.allWebsiteDataTypes()
      if domains.isEmpty {
        await store.removeData(ofTypes: types, modifiedSince: .distantPast)
      } else {
        // Records are grouped by site ("reddit.com"); match it and its
        // subdomains.
        let records = await store.dataRecords(ofTypes: types)
        let matching = records.filter { record in
          domains.contains { domain in
            record.displayName == domain || record.displayName.hasSuffix("." + domain)
          }
        }
        await store.removeData(ofTypes: types, for: matching)
      }
      UserDefaults.standard.removeObject(forKey: Self.domainsKey)
      UserDefaults.standard.set(false, forKey: Self.requestKey)
      UserDefaults.standard.set(Date().timeIntervalSince1970, forKey: Self.doneKey)
      self.inProgress = false
    }
  }
}
