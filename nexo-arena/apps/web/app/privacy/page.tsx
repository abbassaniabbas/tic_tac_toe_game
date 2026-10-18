import { PRIVACY_SECTIONS } from "@nexo/shared";
import { Information, SupportContact } from "../../components/information";
export const metadata = { title: "Privacy · NEXO Arena" };
export default function Privacy() {
  return (
    <Information title="Privacy & your data">
      <p>
        Updated 11 October 2026. This notice describes the data used by NEXO
        Arena.
      </p>
      {PRIVACY_SECTIONS.map((s) => (
        <section key={s.title}>
          <h2>{s.title}</h2>
          <p>{s.text}</p>
          {s.title === "Delete your account" && (
            <a href="/delete-account">Delete your NEXO Arena account →</a>
          )}
        </section>
      ))}
      <section>
        <h2>Contact</h2>
        <SupportContact />
      </section>
    </Information>
  );
}
