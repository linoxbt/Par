import type { Metadata } from "next"
import { CIRCUIT, CONFIGURED, FACTORY, MUSD_DEFAULTS, NETWORK, addrUrl } from "@/lib/config"
import { short } from "@/lib/format"
import { CodeCard, CopyChip } from "@/components/landing/CodeCard"
import { DocHero, DocSection, Mono, NextLink, Pre, Table } from "@/components/landing/Doc"

const A = ({ a }: { a?: string }) =>
  a ? (
    <a href={addrUrl(a)} target="_blank" rel="noreferrer" className="num text-fg underline decoration-line-strong underline-offset-4 hover:decoration-btc">
      {short(a)}
    </a>
  ) : (
    <span className="text-subtle">deployment pending</span>
  )

export const metadata: Metadata = {
  title: "Developers",
  description: "Par's three contracts (ParFactory, ParVault, ParCircuit), their functions and events, the keeper, and how to run the tests and a local demo.",
  alternates: { canonical: "/developers" },
}

// Server component: the code card and copy chips hydrate on their own.
export default function Developers() {
  const musd = MUSD_DEFAULTS[NETWORK]
  return (
    <div>
      <DocHero kicker="Developers" title="Three contracts." muted="One keeper. This app." sub="Everything Par does is onchain and permissionless: anyone can trigger a missed payment, execute an undisputed claim or force-settle a defaulter.">
        <div className="mt-8 grid items-start gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="flex min-w-0 flex-col gap-3">
            <CopyChip text="git clone https://github.com/linoxbt/par && cd par" />
            <CopyChip text="./scripts/dev-local.sh" />
            <p className="text-sm text-muted">
              Run the second command from the repository root. It installs dependencies, runs a local chain with a model of MUSD, deploys Par, seeds both
              demos, and starts the keeper and this app.
            </p>
          </div>
          <div className="min-w-0">
            <CodeCard />
          </div>
        </div>
      </DocHero>

      <DocSection n="01" title="Quickstart">
        <p className="mb-6 text-sm text-muted">Every command below runs from the repository root.</p>
        <ol className="space-y-6">
          {[
            ["Run the tests", "Against a model of the MUSD rules Par relies on.", "cd contracts && npm i && npm test"],
            ["Run them against real MUSD", "Clones mezo-org/musd and runs the core suite (test/Par.test.ts) on its fixtures.", "cd contracts && npm run test:musd"],
            ["Deploy to Mezo testnet", "Needs a key holding testnet BTC for gas. Prints the frontend env.", "cd contracts && MATSNET_PRIVATE_KEY=… npm run deploy:matsnet"],
            ["Start the keeper", "Watches every vault and circle, simulates first, alerts on Recovery Mode.", "cd keeper && npm i && FACTORY=… CIRCUIT=… KEEPER_KEY=… npm start"],
          ].map(([t, d, cmd], i) => (
            <li key={t} className="grid min-w-0 gap-3 sm:grid-cols-[28px_1fr]">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-fg font-mono text-xs text-white">{i + 1}</span>
              <div className="min-w-0">
                <div className="font-medium">{t}</div>
                <p className="mt-1 text-sm text-muted">{d}</p>
                <div className="mt-3">
                  <CopyChip text={cmd} />
                </div>
              </div>
            </li>
          ))}
        </ol>
      </DocSection>

      <DocSection id="contracts" n="02" title="Contracts">
        <Table
          head={["Contract", "What it does", NETWORK === "mainnet" ? "Mainnet" : "Testnet"]}
          rows={[
            [<Mono key="f">ParFactory</Mono>, "Deploys one ParVault clone (EIP-1167) per user and stores risk parameters: stressBps 4000, targetIcr 160%.", <A key="a" a={CONFIGURED ? FACTORY : undefined} />],
            [<Mono key="v">ParVault</Mono>, "Owns the MUSD trove. Holds commitments (Scheduled, Claim, ClearingLine), runs the health check and the payout waterfall.", <span key="s" className="text-subtle">one clone per user</span>],
            [<Mono key="c">ParCircuit</Mono>, "Circles with invite-and-join membership (only factory vaults can join), invoices, O(1) netting, settle, forceSettle and claim.", <A key="a" a={CONFIGURED ? CIRCUIT : undefined} />],
          ]}
        />
        {musd && (
          <div className="mt-6">
            <p className="mb-3 text-sm text-muted">Par integrates with the official MUSD deployment (@mezo-org/musd-contracts 1.1.0):</p>
            <Table
              head={["MUSD contract", "Address"]}
              rows={[
                ["BorrowerOperations", <A key="1" a={musd.borrowerOps} />],
                ["TroveManager", <A key="2" a={musd.troveManager} />],
                ["PriceFeed", <A key="3" a={musd.priceFeed} />],
                ["MUSD token", <A key="4" a={musd.musd} />],
              ]}
            />
          </div>
        )}
      </DocSection>

      <DocSection n="03" title="Functions">
        <div className="grid gap-4 md:grid-cols-2">
          {[
            ["ParVault · owner", ["openTrove(seed, up, lo) payable", "createScheduled(…) · start ≥ now, expiry ≥ last due + grace + 300 s", "createClaim(…) · arbiter ≠ owner, beneficiary, principal · window ≥ 60 s", "createClearingLine(circuit, cap, expiry)", "withdrawCollateral / borrow / repay", "refinance(up, lo)", "withdrawMUSDBuffer / withdrawIdleBTC", "claimCollateral()", "closeTrove()", "transferOwnership(to) → acceptOwnership()"]],
            ["ParVault · anyone", ["topUp(up, lo) payable", "payInstallment(id, index)", "triggerMissed(id, index, up, lo)", "executeClaim(id, up, lo) · undisputed after window, disputed after 7 days", "closeCommitment(id) · after expiry (beneficiary: any time); not while a claim is open or an expired line is owed (LineOwed)", "health(extra) → ok, stressedIcr, headroom", "recoveryTopUp(draw, price) → btc"]],
            ["ParVault · claim parties", ["fileClaim(id, amount, evidence) · beneficiary", "disputeClaim(id) · principal or owner", "resolveClaim(id, approve, up, lo) · arbiter, within 7 days"]],
            ["ParCircuit · members", ["createCircle(cycleLength, settleWindow)", "addMember(circle, member, vault, lineId) · admin invites", "join(circle, vault, lineId) · member accepts", "removeMember(circle, member) · admin or member", "setSuspended(circle, member, bool) · admin only", "createInvoice(circle, debtor, amount, ref) · not if suspended", "acceptInvoice(id) · not if suspended / rejectInvoice(id)", "settle(circle, cycle)", "claim(circle, cycle)"]],
            ["ParCircuit · anyone", ["forceSettle(circle, cycle, debtor, up, lo) · draws the line, even after its expiry", "suspended(circle, member)", "net / gross / totalOwed / collected", "nettingEfficiencyBps(circle, cycle)", "creditLimit / lineHeadroom(circle, member)", "currentCycle / cycleClose / finalAt"]],
          ].map(([h, fns]) => (
            <div key={h as string} className="rounded-2xl border border-line bg-white p-5 shadow-card">
              <div className="text-sm font-medium">{h}</div>
              <ul className="mt-3 space-y-1.5">
                {(fns as string[]).map((f) => (
                  <li key={f} className="font-mono text-[12.5px] text-muted">
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </DocSection>

      <DocSection n="04" title="Events">
        <Pre>{`ParFactory : VaultCreated(owner, vault)  VaultOwnerChanged(vault, from, to)
ParVault   : TroveOpened(coll, seed)  CommitmentCreated(id, kind, beneficiary, cap, expiry)
             InstallmentPaid(id, index, payer, amount)  InstallmentMissed(id, index, amount)
             ClaimFiled(id, amount, evidence)  ClaimDisputed(id)  ClaimResolved(id, approved)
             Payout(id, to, amount, fromBuffer, minted)  CommitmentClosed(id, released)
             OwnershipTransferStarted(from, to)  OwnershipTransferred(from, to)  CollateralClaimed(amount)
ParCircuit : CircleCreated  MemberInvited  MemberJoined  MemberRemoved  MemberSuspended(circle, member, suspended)
             InvoiceCreated  InvoiceAccepted  InvoiceRejected
             Settled(circle, cycle, debtor, amount, forced)  Claimed(circle, cycle, creditor, amount)
             CycleFinalized(circle, cycle, collected, totalOwed)`}</Pre>
      </DocSection>

      <DocSection id="keeper" n="05" title="Keeper">
        <Table
          head={["Job", "Condition", "Call"]}
          rows={[
            ["Missed installments", "Scheduled, index unsettled, now > due + grace", <Mono key="1">vault.triggerMissed</Mono>],
            ["Claims", "Open: undisputed and now > filedAt + window, or disputed and the 7-day arbiter deadline passed", <Mono key="2">vault.executeClaim</Mono>],
            ["Circuit", "now ≥ close + settleWindow, net < 0, unsettled", <Mono key="3">circuit.forceSettle</Mono>],
            ["Health watch", "health(0).ok == false", "alert the owner"],
            ["Recovery Mode", "revert RecoveryModeNeedsReserve(b)", "alert with b, retry"],
          ]}
        />
        <p className="mt-4 text-sm text-muted">Every call is simulated first, so a job that isn&apos;t due costs nothing. Hints come from HintHelpers and SortedTroves, with zero hints as a fallback.</p>
        <div className="mt-6">
          <NextLink href="/security">Read the risk model</NextLink>
        </div>
      </DocSection>
    </div>
  )
}
