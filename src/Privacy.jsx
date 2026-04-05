export default function Privacy({ onBack }) {
  return (
    <div style={{ minHeight: "100vh", background: "#FAFAF7", fontFamily: "'DM Sans', sans-serif", color: "#1A1A1A" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "rgba(250,250,247,0.85)",
        backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(226,224,216,0.6)",
      }}>
        <div style={{ maxWidth: 640, margin: "0 auto", padding: "14px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span onClick={onBack} style={{ fontWeight: 700, fontSize: 18, color: "#2D5A3D", letterSpacing: "-0.5px", cursor: "pointer" }}>startlista</span>
          <span onClick={onBack} style={{ fontSize: 13, color: "#C4C3BB", cursor: "pointer" }}>← Tilbake</span>
        </div>
      </nav>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "48px 24px 80px" }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.8px", marginBottom: 32, margin: "0 0 32px" }}>Personvernerklæring</h1>
        <div style={{ fontSize: 12, color: "#C4C3BB", marginBottom: 32 }}>Sist oppdatert: april 2026</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <section>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, margin: "0 0 8px" }}>Ansvarlig</h2>
            <p style={{ fontSize: 14, color: "#7A7A6E", lineHeight: 1.7, margin: 0 }}>
              Martin Brekke er ansvarlig for behandlingen av personopplysninger på startlista.no.
              Ved spørsmål om personvern kan du kontakte oss på: martin.brekke@hotmail.com
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, margin: "0 0 8px" }}>Hva vi lagrer</h2>
            <p style={{ fontSize: 14, color: "#7A7A6E", lineHeight: 1.7, margin: 0 }}>
              Når du oppretter en profil på startlista.no, lagrer vi fornavn og etternavn, e-postadresse (brukes kun til innlogging og kontobekreftelse), fylke, løp du legger inn på din terminliste (løpsnavn, dato, distanse, målsetning og eventuell sluttid), hvem du følger, og eventuelle rapporter du sender inn om feil i løpsinformasjon.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, margin: "0 0 8px" }}>Hvorfor vi lagrer det</h2>
            <p style={{ fontSize: 14, color: "#7A7A6E", lineHeight: 1.7, margin: 0 }}>
              Vi lagrer disse opplysningene for å la deg opprette og vedlikeholde din personlige løpsprofil, vise din terminliste til andre innloggede brukere på plattformen, la deg følge andre løperes planer, og forbedre kvaliteten på løpsinformasjonen gjennom innrapporterte feil. Behandlingsgrunnlaget er samtykke som du gir ved registrering.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, margin: "0 0 8px" }}>Samtykke</h2>
            <p style={{ fontSize: 14, color: "#7A7A6E", lineHeight: 1.7, margin: 0 }}>
              Ved registrering samtykker du til at ditt navn, fylke, løp, målsetninger og sluttider er synlige for andre innloggede brukere av startlista.no. Du kan når som helst trekke tilbake ditt samtykke ved å slette kontoen din.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, margin: "0 0 8px" }}>Synlighet</h2>
            <p style={{ fontSize: 14, color: "#7A7A6E", lineHeight: 1.7, margin: 0 }}>
              Ditt navn, fylke, planlagte løp, målsetninger og sluttider er synlig for alle innloggede brukere av startlista.no. Din e-postadresse er ikke synlig for andre og brukes kun til innlogging og kontobekreftelse. Hvem du følger er kun synlig for deg selv.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, margin: "0 0 8px" }}>Deling med tredjeparter</h2>
            <p style={{ fontSize: 14, color: "#7A7A6E", lineHeight: 1.7, margin: 0 }}>
              Vi selger ikke, deler ikke eller gir bort dine personopplysninger til tredjeparter. Følgende tjenesteleverandører benyttes for drift av plattformen: Supabase (database og autentisering, data lagres i EU/Irland), Vercel (hosting), og Resend (utsending av bekreftelsese-post og passordtilbakestilling). Ingen av disse tjenesteleverandørene har tilgang til dine data utover det som er nødvendig for å levere tjenesten.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, margin: "0 0 8px" }}>Informasjonskapsler</h2>
            <p style={{ fontSize: 14, color: "#7A7A6E", lineHeight: 1.7, margin: 0 }}>
              startlista.no bruker kun nødvendige informasjonskapsler for innlogging og sesjonshåndtering. Vi bruker ingen sporings- eller analyseverktøy, og samler ikke inn data om din nettleseraktivitet.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, margin: "0 0 8px" }}>Dine rettigheter</h2>
            <p style={{ fontSize: 14, color: "#7A7A6E", lineHeight: 1.7, margin: 0 }}>
              I henhold til GDPR har du rett til å se hvilke opplysninger vi har lagret om deg, endre eller oppdatere dine opplysninger via din profil (navn, e-postadresse, fylke og passord), be om at dine data overføres til en annen tjeneste (dataportabilitet), og slette din konto og alle tilknyttede data permanent. Du kan slette kontoen din under Innstillinger på Min profil. Alle dine data fjernes umiddelbart ved sletting. For innsyn i lagrede data, kontakt oss på e-postadressen over.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, margin: "0 0 8px" }}>Lagring og sikkerhet</h2>
            <p style={{ fontSize: 14, color: "#7A7A6E", lineHeight: 1.7, margin: 0 }}>
              Alle data lagres hos Supabase i EU (Irland). Kommunikasjon mellom din nettleser og våre servere er kryptert med HTTPS. Passord lagres aldri i klartekst.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, margin: "0 0 8px" }}>Endringer</h2>
            <p style={{ fontSize: 14, color: "#7A7A6E", lineHeight: 1.7, margin: 0 }}>
              Dersom vi gjør vesentlige endringer i denne personvernerklæringen, vil oppdatert versjon bli publisert på denne siden med ny dato.
            </p>
          </section>
        </div>
      </div>

      <footer style={{ padding: "24px", textAlign: "center", fontSize: 11, color: "#C4C3BB", borderTop: "1px solid #EDECE6" }}>
        <div>startlista.no · laget for løpere som vil finne hverandre</div>
      </footer>
    </div>
  );
}
