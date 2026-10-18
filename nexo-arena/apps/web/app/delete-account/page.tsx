import { Information, SupportContact } from "../../components/information";
import { WebAccountProvider } from "../../lib/online";
import { OnlinePanel } from "../../components/online-panel";
export const metadata = { title: "Delete account · NEXO Arena" };
export default function DeleteAccount() {
  return (
    <Information title="Delete your NEXO Arena account">
      <p>
        Sign in below with your account email. Choose Delete account, then
        confirm deletion. You can use this page without installing the mobile
        app.
      </p>
      <p>
        Your sign-in account, profile, collection and verified solves are
        removed. Open games close, and retained match moves and rating events
        are anonymized. Local practice stays on your device until you clear its
        storage.
      </p>
      <WebAccountProvider>
        <OnlinePanel />
      </WebAccountProvider>
      <section>
        <h2>Unable to sign in?</h2>
        <SupportContact />
      </section>
    </Information>
  );
}
