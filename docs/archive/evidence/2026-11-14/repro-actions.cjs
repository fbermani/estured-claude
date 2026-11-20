/**
 * Isolated security regressions: real TypeScript modules, mocked dependencies.
 * No environment files, credentials, network calls, database or repository writes.
 * Run from the EstuRed repository:
 * node docs/audits/evidence/2026-11-14/repro-actions.cjs
 */
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const path = require('node:path');
const projectRequire = createRequire(path.join(process.cwd(), 'package.json'));
const ts = projectRequire('typescript');

function moduleFrom(relativePath, dependencies) {
  const exports = {};
  const source = fs.readFileSync(relativePath, 'utf8');
  const javascript = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(javascript, {
    exports,
    require(name) {
      if (name === 'server-only') return {};
      if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
      return dependencies[name];
    },
    console,
    Date,
    crypto: globalThis.crypto,
  }, { filename: relativePath });
  return exports;
}

async function proposalForPausedResidence() {
  let created = 0;
  const reads = [];
  const rows = {
    student_profiles: { id: 'student' },
    family_application_proposals: {
      id: 'proposal', status: 'pending_student_approval', expires_at: '2099-01-01',
      student_profile_id: 'student', residence_id: 'paused-residence', room_type_id: 'room',
      family_link_id: 'link', desired_start_date: '2027-02-01', initial_duration_months: 3,
    },
    family_links: { id: 'link', status: 'active', family_members: { phone: 'test' } },
    room_types: {
      id: 'room', monthly_price_usd: 300, is_active: true,
      profile_availability: { status: 'available' },
    },
    residences: { id: 'paused-residence', status: 'paused_by_admin' },
  };
  const admin = {
    from(table) {
      reads.push(table);
      const result = { data: rows[table], count: 0, error: null };
      const builder = {
        select: () => builder, eq: () => builder, in: () => builder, update: () => builder,
        maybeSingle: async () => result,
        then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
      };
      return builder;
    },
  };
  const module = moduleFrom('lib/applications/recordFamilyProposalResponse.ts', {
    '@/lib/regulations/acceptance': { regulationAcceptanceEnabled: async () => false },
    '@/lib/family/familyMilestones': { notifyFamilyProposalOutcome: async () => {} },
    '@/lib/audit': { createAuditLog: async () => true },
    '@/lib/applications/types': { ACTIVE_APPLICATION_STATUSES: ['submitted'] },
    '@/lib/applications/createRequestFromRoomType': {
      createApplicationFromRoomType: async () => { created++; return { id: 'new-application' }; },
    },
    '@/lib/availability/typeAvailability': {
      typeAvailabilityState: () => ({}), requestBlockedMessage: () => null,
    },
    '@/lib/students/reservationWindow': { checkReservationWindowOverlap: async () => ({ ok: true }) },
  });
  const result = await module.recordFamilyProposalResponse(admin, {
    proposalId: 'proposal', decision: 'approve', actorUserId: 'student-user',
    rejectionReason: null, academicObjective: 'Una carrera universitaria',
  });
  assert.equal(result.ok, true);
  assert.equal(created, 1);
  assert.equal(reads.includes('residences'), false);
  return {
    case: 'family proposal converted while residence paused_by_admin',
    result, created, residenceFixtureStatus: rows.residences.status,
    residenceStatusQueried: reads.includes('residences'),
    limitation: 'Creation helper is mocked; its absence of status validation was reviewed statically.',
  };
}

async function expiredRenewalFee() {
  const fee = { id: 'fee', status: 'expired', expires_at: '2000-01-01', manual_payment_file_id: 'first-proof' };
  const writes = [];
  const admin = {
    storage: { from: () => ({ upload: async () => ({ error: null }) }) },
    from(table) {
      let update = null;
      const result = {
        data: table === 'renewal_offers'
          ? { id: 'offer', status: 'estured_fee_pending', student_profile_id: 'student', estured_fee_payment_id: 'fee' }
          : table === 'student_profiles' ? { id: 'student' }
          : table === 'files' ? { id: 'new-proof' } : fee,
        error: null,
      };
      const builder = {
        select: () => builder, eq: () => builder, insert: () => builder,
        update: (value) => { update = value; return builder; },
        single: async () => result, maybeSingle: async () => result,
        then(resolve, reject) {
          if (update) {
            writes.push({ table, update });
            if (table === 'estured_fee_payments') Object.assign(fee, update);
          }
          return Promise.resolve(result).then(resolve, reject);
        },
      };
      return builder;
    },
  };
  const module = moduleFrom('lib/renewals/registerRenewalManualFeePayment.ts', {
    '@/lib/audit': { createAuditLog: async () => true },
    '@/lib/files/sniffFile': {
      resolveDocumentType: async () => 'application/pdf',
      extensionForMime: () => 'pdf', toTypedBlob: async (file) => file,
    },
    '@/lib/files/safeFilename': { safeFilename: (name) => name },
  });
  const result = await module.registerRenewalManualFeePayment(admin, {
    renewalOfferId: 'offer', actorUserId: 'student-user',
    file: { size: 20, type: 'application/pdf', name: 'test.pdf' },
    payerBillingName: 'Test', payerBillingCuit: null,
    payerIvaCondition: 'consumidor_final', paymentChannel: null, acknowledgeNoRefund: true,
  });
  assert.equal(result.ok, true);
  assert.equal(fee.status, 'pending_manual_payment');
  assert.equal(fee.manual_payment_file_id, 'new-proof');
  return { case: 'expired renewal fee becomes pending_manual_payment', result, fee, writes };
}

(async () => {
  console.log(JSON.stringify({
    verification: 'PASS: both unsafe behaviors reproduced in isolated mocks',
    databaseAccess: false,
    cases: [await proposalForPausedResidence(), await expiredRenewalFee()],
  }, null, 2));
})().catch((error) => { console.error(error); process.exitCode = 1; });
