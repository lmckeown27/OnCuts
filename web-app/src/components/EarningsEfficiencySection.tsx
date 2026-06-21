import { ArrowDown, TrendingUp } from 'lucide-react';

type FlowStepProps = {
  label: string;
  detail?: string;
  amount: string;
  muted?: boolean;
};

function FlowStep({ label, detail, amount, muted }: FlowStepProps) {
  return (
    <div className="flex items-start justify-between gap-6 py-4 border-b border-gray-100 last:border-b-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-700">{label}</p>
        {detail && <p className="mt-1 text-xs text-gray-400">{detail}</p>}
      </div>
      <p className={`shrink-0 text-lg font-semibold tabular-nums ${muted ? 'text-gray-500' : 'text-gray-900'}`}>
        {amount}
      </p>
    </div>
  );
}

function FlowArrow() {
  return (
    <div className="flex justify-center py-1">
      <ArrowDown className="h-4 w-4 text-gray-300" aria-hidden="true" />
    </div>
  );
}

type EarningsColumnProps = {
  title: string;
  customerPays: string;
  feeLabel: string;
  feeDetail: string;
  feeAmount: string;
  barberEarns: string;
  highlight?: boolean;
};

function EarningsColumn({
  title,
  customerPays,
  feeLabel,
  feeDetail,
  feeAmount,
  barberEarns,
  highlight = false,
}: EarningsColumnProps) {
  return (
    <article className="rounded-2xl border border-gray-200 bg-white p-6 md:p-8">
      <h3 className="text-lg font-semibold tracking-tight text-gray-900 md:text-xl">{title}</h3>

      <div className="mt-6">
        <FlowStep label="Customer Pays" amount={customerPays} />
        <FlowArrow />
        <FlowStep label={feeLabel} detail={feeDetail} amount={feeAmount} muted />
        <FlowArrow />
        <div className="pt-6">
          <div className="flex items-end justify-between gap-4">
            <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">Barber Earns</p>
            <p
              className={`text-4xl font-bold tabular-nums tracking-tight md:text-5xl ${
                highlight ? 'text-emerald-700' : 'text-gray-900'
              }`}
            >
              {barberEarns}
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}

export default function EarningsEfficiencySection() {
  return (
    <section className="border-t border-gray-100 bg-white px-4 py-20 md:py-24" id="pricing">
      <div className="mx-auto max-w-5xl">
        <div className="mb-12 text-center md:mb-16">
          <h2 className="text-4xl font-bold tracking-tight text-gray-900 md:text-5xl">
            Maximizing Barber Yield
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-10">
          <EarningsColumn
            title="Traditional Barbershop"
            customerPays="$35"
            feeLabel="Infrastructure & Overhead Fee (50%)"
            feeDetail="Rent, utilities, reception, overhead"
            feeAmount="−$17.50"
            barberEarns="$17.50"
          />
          <EarningsColumn
            title="CampusCuts"
            customerPays="$28"
            feeLabel="Infrastructure & Tech Fee (15%)"
            feeDetail="Booking, payments, and discovery tools"
            feeAmount="−$4.20"
            barberEarns="$23.80"
            highlight
          />
        </div>

        <div className="mt-10 flex justify-center md:mt-12">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-5 py-2.5">
            <TrendingUp className="h-4 w-4 text-emerald-700" aria-hidden="true" />
            <span className="text-sm font-bold text-emerald-800 md:text-base">36% higher take-home pay</span>
          </div>
        </div>
      </div>
    </section>
  );
}
