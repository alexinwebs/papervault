import { Clause } from "@/components/LegalDoc";
import { siteContact } from "@/lib/site";

/** Who runs the service and how to reach them, including the grievance officer. */
export function ContactClause() {
  const site = siteContact();
  return (
    <Clause heading="Contact and grievances">
      <p>
        PaperVault is operated by {site.operator}. Questions about these terms or your data:{" "}
        <a href={`mailto:${site.contact}`} className="underline">
          {site.contact}
        </a>
        .
      </p>
      <p>
        Complaints may be addressed to our {site.grievanceName} at{" "}
        <a href={`mailto:${site.grievance}`} className="underline">
          {site.grievance}
        </a>
        . We acknowledge complaints within 24 hours and aim to resolve them within 15 days.
      </p>
    </Clause>
  );
}
