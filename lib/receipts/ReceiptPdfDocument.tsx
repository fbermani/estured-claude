import "server-only";
import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";

export type ReceiptPdfPayload = {
  student?: { first_name?: string; last_initial?: string };
  residence?: { name?: string; public_area?: string };
  room_type?: string;
  desired_start_date?: string;
  initial_duration_months?: number;
  academic_objective?: string;
  final_conditions?: { monthly_price_usd?: number; enrollment_fee_usd?: number; deposit_usd?: number };
  estured_fee?: { amount_ars?: number; currency?: string; paid_at?: string };
  adjustment_policy?: string;
  disclaimer?: string;
};

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, color: "#1a1a1a" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  brand: { fontSize: 16, fontWeight: 700, color: "#0F5C7A" },
  title: { fontSize: 14, fontWeight: 700, marginTop: 18 },
  receiptNumber: { fontSize: 9, color: "#666666", marginTop: 2 },
  statusBadge: { fontSize: 9, fontWeight: 700, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 10 },
  statusValid: { backgroundColor: "#E4F3EA", color: "#2D6A4F" },
  statusVoided: { backgroundColor: "#FBE4E4", color: "#C53030" },
  card: { marginTop: 16, borderWidth: 1, borderColor: "#E0DAD0", borderRadius: 6, padding: 16 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#EFEAE1",
    paddingVertical: 6,
  },
  lastRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  label: { color: "#666666" },
  value: { fontWeight: 700, maxWidth: "60%", textAlign: "right" },
  objective: { marginTop: 10, fontSize: 9, color: "#333333" },
  disclaimer: { marginTop: 16, fontSize: 8, color: "#666666", backgroundColor: "#FAF9F7", padding: 10, borderRadius: 4 },
  footer: { marginTop: 24, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  qr: { width: 72, height: 72 },
  verificationText: { fontSize: 8, color: "#666666", maxWidth: 320 },
});

function formatUsd(value?: number) {
  if (value === undefined || value === null) return "—";
  return `USD ${value.toLocaleString("es-AR")}`;
}

function formatArs(value?: number) {
  if (value === undefined || value === null) return "—";
  return `ARS ${value.toLocaleString("es-AR")}`;
}

export function ReceiptPdfDocument({
  receiptNumber,
  status,
  issuedAt,
  payload,
  qrDataUrl,
  verificationUrl,
}: {
  receiptNumber: string;
  status: string;
  issuedAt: string | null;
  payload: ReceiptPdfPayload;
  qrDataUrl: string;
  verificationUrl: string;
}) {
  const isVoided = status === "voided";

  return (
    <Document title={`Comprobante ${receiptNumber}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <Text style={styles.brand}>EstuRed</Text>
          <Text style={[styles.statusBadge, isVoided ? styles.statusVoided : styles.statusValid]}>
            {isVoided ? "ANULADO" : "VÁLIDO"}
          </Text>
        </View>

        <Text style={styles.title}>Comprobante de Reserva Confirmada</Text>
        <Text style={styles.receiptNumber}>N.º {receiptNumber}</Text>

        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>Estudiante</Text>
            <Text style={styles.value}>
              {payload.student?.first_name} {payload.student?.last_initial}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Residencia</Text>
            <Text style={styles.value}>
              {payload.residence?.name} · {payload.residence?.public_area}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Tipo de habitación</Text>
            <Text style={styles.value}>{payload.room_type}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Fecha de ingreso</Text>
            <Text style={styles.value}>{payload.desired_start_date}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Duración inicial</Text>
            <Text style={styles.value}>{payload.initial_duration_months} meses</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Tarifa mensual acordada</Text>
            <Text style={styles.value}>{formatUsd(payload.final_conditions?.monthly_price_usd)}</Text>
          </View>
          <View style={styles.lastRow}>
            <Text style={styles.label}>Fee EstuRed pagado</Text>
            <Text style={styles.value}>{formatArs(payload.estured_fee?.amount_ars)}</Text>
          </View>

          {payload.academic_objective ? (
            <Text style={styles.objective}>Objetivo académico: {payload.academic_objective}</Text>
          ) : null}
        </View>

        <Text style={styles.disclaimer}>{payload.disclaimer}</Text>

        <View style={styles.footer}>
          <View>
            <Text style={styles.verificationText}>
              Verificá este comprobante escaneando el código o visitando:
            </Text>
            <Text style={styles.verificationText}>{verificationUrl}</Text>
            <Text style={[styles.verificationText, { marginTop: 6 }]}>
              Emitido: {issuedAt ? new Date(issuedAt).toLocaleDateString("es-AR") : "—"}
            </Text>
          </View>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf's Image has no `alt` prop, this isn't an HTML <img> */}
          <Image src={qrDataUrl} style={styles.qr} />
        </View>
      </Page>
    </Document>
  );
}
