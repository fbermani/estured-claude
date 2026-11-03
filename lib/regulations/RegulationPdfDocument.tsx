import "server-only";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

import { MODEL_LEGAL_NOTE, renderPlaceholders } from "@/lib/regulations/modelTemplate";

const BASE_MODEL_NOTICE =
  "Esta residencia todavía no cargó su propio reglamento: este es el modelo de convivencia de EstuRed. Consultá con la residencia los puntos que quieras confirmar.";

const styles = StyleSheet.create({
  page: { paddingTop: 48, paddingHorizontal: 50, paddingBottom: 60, fontFamily: "Helvetica", fontSize: 10, color: "#1a1a1a", lineHeight: 1.5 },
  title: { fontSize: 20, fontWeight: 700, color: "#0F5C7A" },
  residence: { fontSize: 12, fontWeight: 700, marginTop: 4 },
  meta: { fontSize: 9, color: "#666666", marginTop: 3 },
  notice: { marginTop: 12, fontSize: 9, color: "#333333", backgroundColor: "#FAF9F7", padding: 8, borderRadius: 4 },
  divider: { marginTop: 14, borderBottomWidth: 1, borderBottomColor: "#E0DAD0" },
  section: { marginTop: 16, marginBottom: 2, fontSize: 10, fontWeight: 700, letterSpacing: 1, color: "#0F5C7A" },
  block: { marginTop: 8 },
  articleTitle: { fontWeight: 700 },
  paragraph: { marginTop: 2 },
  bulletRow: { flexDirection: "row", marginTop: 2 },
  bullet: { width: 12 },
  bulletText: { flex: 1 },
  legal: { marginTop: 20, fontSize: 8, color: "#666666", backgroundColor: "#FAF9F7", padding: 8, borderRadius: 4 },
  footer: {
    position: "absolute",
    left: 50,
    right: 50,
    bottom: 28,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: "#888888",
  },
});

const BULLET_RE = /^\s*[-•*]\s+(.*)$/;

/** Líneas de un bloque: las que empiezan con «- », «• » o «* » son viñetas; el resto, párrafo. */
function Lines({ lines }: { lines: string[] }) {
  return (
    <>
      {lines.map((line, i) => {
        const m = line.match(BULLET_RE);
        if (m) {
          return (
            <View key={i} style={styles.bulletRow}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.bulletText}>{m[1]}</Text>
            </View>
          );
        }
        return (
          <Text key={i} style={styles.paragraph}>
            {line}
          </Text>
        );
      })}
    </>
  );
}

/**
 * PDF del reglamento vigente de una residencia (DR18). Mismo criterio de lectura que `components/regulations/RegulationText.tsx`: línea en
 * MAYÚSCULAS sola = título de sección; bloque que empieza con «Art. N.» = artículo (primera línea en negrita). Formato básico, sin imágenes.
 */
export function RegulationPdfDocument({
  residenceName,
  text,
  versionNumber,
  isBaseModel,
}: {
  residenceName: string;
  text: string;
  versionNumber: number | null;
  isBaseModel: boolean;
}) {
  const blocks = renderPlaceholders(text).split(/\n{2,}/).filter((b) => b.trim().length > 0);
  return (
    <Document title={`Reglamento de convivencia — ${residenceName}`} author="EstuRed">
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Reglamento de convivencia</Text>
        <Text style={styles.residence}>{residenceName}</Text>
        {!isBaseModel && versionNumber != null && <Text style={styles.meta}>Versión {versionNumber}</Text>}
        {isBaseModel && <Text style={styles.notice}>{BASE_MODEL_NOTICE}</Text>}
        <View style={styles.divider} />

        {blocks.map((block, i) => {
          const [first, ...rest] = block.split("\n");
          const isSection = rest.length === 0 && first === first.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(first) && first.length < 80;
          if (isSection) {
            return (
              <Text key={i} style={styles.section} minPresenceAhead={40}>
                {first}
              </Text>
            );
          }
          if (/^Art\.\s*\d+\./.test(first)) {
            return (
              <View key={i} style={styles.block}>
                <Text style={styles.articleTitle}>{first}</Text>
                <Lines lines={rest} />
              </View>
            );
          }
          return (
            <View key={i} style={styles.block}>
              <Lines lines={[first, ...rest]} />
            </View>
          );
        })}

        {isBaseModel && <Text style={styles.legal}>{MODEL_LEGAL_NOTE}</Text>}

        <View style={styles.footer} fixed>
          <Text>EstuRed</Text>
          <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
