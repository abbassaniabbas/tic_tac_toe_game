import { Information, SupportContact } from "../../components/information";
export const metadata = { title: "Support · NEXO Arena" };
export default function Support() {
  return (
    <Information title="How can we help?">
      <section>
        <h2>Play offline</h2>
        <p>
          Local games and Studio practice are available without an account. On
          the web, open the production site once and wait for Offline play ready
          before disconnecting. Standalone mobile builds include their game
          assets.
        </p>
      </section>
      <section>
        <h2>Restore an online game</h2>
        <p>
          Sign in with the same email, then open Rooms & history in Online or
          Blitz & rooms in Studio. Reconnect and refresh the match before
          playing. Blitz clocks continue while you are away; untimed games
          remain open until a participant ends them.
        </p>
      </section>
      <section>
        <h2>Sign-in codes</h2>
        <p>
          Request a new code in Online, check your inbox and spam folder, and
          enter the latest six-digit code within ten minutes. Avoid requesting
          several codes at once.
        </p>
      </section>
      <section>
        <h2>Account and data</h2>
        <p>
          You can edit your profile, turn leaderboard visibility off, sign out
          or delete your account from Online.
        </p>
        <a href="/delete-account">Delete your NEXO Arena account →</a>
      </section>
      <section>
        <h2>Contact support</h2>
        <SupportContact />
      </section>
    </Information>
  );
}
