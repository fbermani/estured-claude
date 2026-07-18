import "server-only";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { OwnerResidenceCardData } from "@/lib/residences/ownerDashboard";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, color: "#1a1a1a" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  brand: { fontSize: 16, fontWeight: 700, color: "#0F5C7A" },
  title: { fontSize: 14, fontWeight: 700, marginTop: 18 },
  subtitle: { fontSize: 9, color: "#666666", marginTop: 2 },
  ownerLine: { fontSize: 8, color: "#999999", marginTop: 10 },
  card: { marginTop: 16, borderWidth: 1, borderColor: "#E0DAD0", borderRadius: 6, padding: 16 },
  residenceHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  residenceName: { fontSize: 12, fontWeight: 700 },
  residenceZone: { fontSize: 9, color: "#666666", marginTop: 2 },
  statusBadge: { fontSize: 8, fontWeight: 700, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 10 },
  statusSage: { backgroundColor: "#E4F3EA", color: "#2D6A4F" },
  statusAmber: { backgroundColor: "#FDF0D9", color: "#9C6A15" },
  statusNeutral: { backgroundColor: "#F0EEE8", color: "#666666" },
  metricsGrid: { flexDirection: "row", flexWrap: "wrap", marginTop: 12 },
  metricCell: { width: "50%", marginBottom: 8 },
  metricLabel: { fontSize: 8, color: "#666666", textTransform: "uppercase" },
  metricValue: { fontSize: 11, fontWeight: 700, marginTop: 2 },
  footerNote: { marginTop: 24, fontSize: 8, color: "#999999" },
  pageFooter: { position: "absolute", bottom: 24, left: 40, right: 40, fontSize: 8, color: "#999999", textAlign: "center" },
});

function statusStyle(tone: "neutral" | "amber" | "sage") {
  if (tone === "sage") return styles.statusSage;
  if (tone === "amber") return styles.statusAmber;
  return styles.statusNeutral;
}

function formatUsd(value: number | null) {
  if (value === null) return "—";
  return `USD ${value.toLocaleString("es-AR")}`;
}

/**
 * Reporte PDF del portfolio del dueño (docs/12 §15.1, pedido pendiente
 * del Ciclo 34quinvicies). Cada residencia se muestra en su propia
 * sección con SUS métricas propias — nunca sumadas entre residencias
 * (docs/00 §25.3 sigue vigente también acá, no solo en la UI web).
 */
export function PortfolioPdfDocument({
  ownerEmail,
  generatedAt,
  residences,
}: {
  ownerEmail: string;
  generatedAt: string;
  residences: OwnerResidenceCardData[];
}) {
  return (
    <Document title="Reporte de portfolio — EstuRed">
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <Text style={styles.brand}>EstuRed</Text>
        </View>
        <Text style={styles.title}>Reporte de tus residencias</Text>
        <Text style={styles.subtitle}>
          {residences.length} residencia{residences.length === 1 ? "" : "s"} · generado el{" "}
          {new Date(generatedAt).toLocaleDateString("es-AR")}
        </Text>
        <Text style={styles.ownerLine}>Cuenta: {ownerEmail}</Text>

        {residences.map((r) => {
          const occupancyPct = r.capacity > 0 ? Math.round((r.occupied / r.capacity) * 100) : 0;
          return (
            <View key={r.residenceId} style={styles.card} wrap={false}>
              <View style={styles.residenceHeaderRow}>
                <View>
                  <Text style={styles.residenceName}>{r.name}</Text>
                  <Text style={styles.residenceZone}>{r.zone}</Text>
                </View>
                <Text style={[styles.statusBadge, statusStyle(r.statusTone)]}>{r.statusLabel.toUpperCase()}</Text>
              </View>

              <View style={styles.metricsGrid}>
                <View style={styles.metricCell}>
                  <Text style={styles.metricLabel}>Ocupación</Text>
                  <Text style={styles.metricValue}>
                    {r.occupied}/{r.capacity} {r.capacity > 0 ? `(${occupancyPct}%)` : ""}
                  </Text>
                </View>
                <View style={styles.metricCell}>
                  <Text style={styles.metricLabel}>Solicitudes nuevas</Text>
                  <Text style={styles.metricValue}>{r.newApplications}</Text>
                </View>
                <View style={styles.metricCell}>
                  <Text style={styles.metricLabel}>Renovaciones pendientes</Text>
                  <Text style={styles.metricValue}>{r.renewalsPending}</Text>
                </View>
                <View style={styles.metricCell}>
                  <Text style={styles.metricLabel}>Casos de soporte abiertos</Text>
                  <Text style={styles.metricValue}>{r.supportOpen}</Text>
                </View>
                <View style={styles.metricCell}>
                  <Text style={styles.metricLabel}>Tarifa promedio</Text>
                  <Text style={styles.metricValue}>{formatUsd(r.avgPriceUsd)}</Text>
                </View>
              </View>
            </View>
          );
        })}

        <Text style={styles.footerNote}>
          Cada residencia muestra únicamente sus propias métricas — EstuRed no consolida cifras entre residencias
          de un mismo portfolio.
        </Text>

        <Text style={styles.pageFooter} render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} fixed />
      </Page>
    </Document>
  );
}
