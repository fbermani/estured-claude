import "server-only";
import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";

import {
  FUTURE_PAYMENTS_NOTICE,
  INVOICE_NOTICE,
  buildReceiptRows,
  type ReceiptPayload,
  type ReceiptSupplement,
} from "@/lib/receipts/receiptView";

/** Mismo contenido que la pantalla del comprobante (`lib/receipts/receiptView.ts`). */
export type ReceiptPdfPayload = ReceiptPayload;

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

export function ReceiptPdfDocument({
  receiptNumber,
  status,
  issuedAt,
  payload,
  qrDataUrl,
  verificationUrl,
  supplement = {},
}: {
  receiptNumber: string;
  status: string;
  issuedAt: string | null;
  payload: ReceiptPdfPayload;
  qrDataUrl: string;
  verificationUrl: string;
  supplement?: ReceiptSupplement;
}) {
  const isVoided = status === "voided";
  const isReissued = status === "reissued";
  const rows = buildReceiptRows(payload, supplement, issuedAt);
  // El número impreso también verifica a mano en /verify (H14).
  let manualVerifyUrl = "";
  try {
    manualVerifyUrl = `${new URL(verificationUrl).origin}/verify`;
  } catch {
    manualVerifyUrl = "";
  }

  return (
    <Document title={`Comprobante ${receiptNumber}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <Text style={styles.brand}>EstuRed</Text>
          <Text style={[styles.statusBadge, isVoided ? styles.statusVoided : styles.statusValid]}>
            {isVoided ? "ANULADO" : isReissued ? "REEMITIDO" : "VÁLIDO"}
          </Text>
        </View>

        <Text style={styles.title}>Comprobante de Reserva Confirmada</Text>
        <Text style={styles.receiptNumber}>N.º {receiptNumber}</Text>

        <View style={styles.card}>
          {rows.map((row, i) => (
            <View key={row.label} style={i === rows.length - 1 ? styles.lastRow : styles.row} wrap={false}>
              <Text style={styles.label}>{row.label}</Text>
              <Text style={styles.value}>{row.value}</Text>
            </View>
          ))}

          {payload.academic_objective ? (
            <Text style={styles.objective}>Objetivo académico: {payload.academic_objective}</Text>
          ) : null}
        </View>

        <Text style={styles.disclaimer}>{FUTURE_PAYMENTS_NOTICE}</Text>
        <Text style={[styles.disclaimer, { marginTop: 6 }]}>{payload.disclaimer}</Text>
        <Text style={[styles.disclaimer, { marginTop: 6 }]}>{INVOICE_NOTICE}</Text>

        <View style={styles.footer}>
          <View>
            <Text style={styles.verificationText}>
              Verificá este comprobante escaneando el código o visitando:
            </Text>
            <Text style={styles.verificationText}>{verificationUrl}</Text>
            {manualVerifyUrl ? (
              <Text style={[styles.verificationText, { marginTop: 6 }]}>
                O ingresá el número {receiptNumber} en {manualVerifyUrl}
              </Text>
            ) : null}
          </View>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf's Image has no `alt` prop, this isn't an HTML <img> */}
          <Image src={qrDataUrl} style={styles.qr} />
        </View>
      </Page>
    </Document>
  );
}
