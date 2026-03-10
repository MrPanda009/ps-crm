"use client";

import dynamic from "next/dynamic";

const ManualReportForm = dynamic(
  () => import("@/components/citizen/ManualReportForm"),
  { ssr: false }
);

export default function ReportIssuePage() {
  return <ManualReportForm />;
}
