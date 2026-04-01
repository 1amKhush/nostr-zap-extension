import { log } from "../lib/log";
import { FirestoreHandleVerifier } from "../verifier/firestoreVerifier";
import { XVerifiedButtonInjector } from "../x/tweetObserver";

function boot(): void {
  const verifier = new FirestoreHandleVerifier();
  const injector = new XVerifiedButtonInjector(verifier);
  injector.start();
  log.info("Extension boot complete");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}
