/* ─────────────────────────────────────────────────────────────────────────
   YOUR INSPECTION AGREEMENT

   Paste the full text of your InterNACHI agreement between the two backtick
   ( ` ) lines below, replacing everything there now. Copy it from the official
   Word/PDF version in your InterNACHI member account, not retyped by hand.

   These blanks fill in automatically for each customer; type them exactly:
     {{CLIENT}}   the client's name
     {{ADDRESS}}  the property address
     {{DATE}}     the inspection date and time
     {{FEE}}      the fee from the booking, e.g. $520

   For example, paragraph 1 becomes:
     1. The fee for our inspection is {{FEE}}, payable in full at the time of the appointment.

   Blank lines between paragraphs are kept. Save the file and push; the next
   agreement sent uses the new text. Agreements already signed keep the exact
   text that was signed.
   ───────────────────────────────────────────────────────────────────────── */

export const AGREEMENT_TITLE = "InterNACHI® Home Inspection Agreement";

export const AGREEMENT_TEMPLATE = `
This is an Agreement between you, the undersigned Client, and us, the Inspector, pertaining to our inspection of the Property at: {{ADDRESS}}. The terms below govern this Agreement.

1. The fee for our inspection is {{FEE}}, payable in full at the time of the appointment.

2. We will perform a visual inspection of the home/building and provide you with a written report identifying the defects that we (1) observed and (2) deemed material. The report is only supplementary to the seller’s disclosure.

3. Unless otherwise noted in this Agreement or not possible, we will perform the inspection in accordance with the current Standards of Practice (SOP) of the International Association of Certified Home Inspectors (“InterNACHI”), posted at www.nachi.org/sop. If your jurisdiction has adopted mandatory standards that differ from InterNACHI’s SOP, we will perform the inspection in accordance with your jurisdiction’s standards. You understand that InterNACHI’s SOP contains limitations, exceptions, and exclusions. You understand that InterNACHI is not a party to this Agreement, has no control over us, and does not employ or supervise us.

4. Unless otherwise indicated in writing, we will NOT test for the presence of radon, a harmful gas. Unless otherwise indicated in writing, we will not test for mold. Unless otherwise indicated in writing, we will not test for compliance with applicable building codes or for the presence of or for any potential dangers arising from the presence of asbestos, lead paint, soil contamination, or other environmental hazards or violations. If any structure you want us to inspect is a log structure or includes log construction, you understand that such structures have unique characteristics that may make it impossible for us to inspect and evaluate them. Therefore, the scope of our inspection will not include decay of the interior of logs in log walls, log foundations or roofs, or similar defects.

5. Our inspection and report are for your use only. You give us permission to discuss our observations with real estate agents, owners, repair persons, or other interested parties. You will be the sole owner of the report and all rights to it. We are not responsible for use or misinterpretation by third parties, and third parties who rely on it in any way do so at their own risk and release us (including employees and business entities) from any liability whatsoever. If you or any person acting on your behalf provide the report to a third party who then sues you and/or us, you release us from any liability and agree to pay our costs and legal fees in defending any action naming us. Our inspection and report are in no way a guarantee or warranty, express or implied, regarding the future use, operability, habitability or suitability of the home/building or its components. We disclaim all warranties, express or implied, to the fullest extent allowed by law.

6. LIMITATION ON LIABILITY AND DAMAGES. We assume no liability for the cost of repair or replacement of unreported defects, either current or arising in the future. In all cases, our liability is limited to liquidated damages in an amount not greater than 1.5 times the fee you paid us. You waive any claim for consequential, exemplary, special or incidental damages or for the loss of the use of the home/building. You acknowledge that this liquidated damages is not a penalty, but that we intend it to: (i) reflect the fact that actual damages may be difficult or impractical to ascertain; (ii) allocate risk between us; and (iii) enable us to perform the inspection for the agreed-upon fee. If you wish to eliminate this liquidated damages provision, we are willing to perform the inspection for an increased fee, which we will quote on request, payable in advance.

7. We do not perform engineering, architectural, plumbing, or any other job function requiring an occupational license in the jurisdiction where the property is located. If we hold a valid occupational license, we may inform you of this and you may hire us to perform additional functions. Any agreement for such additional services shall be in a separate writing.

8. If you believe you have a claim against us, you agree to provide us with the following: (1) written notification of your claim within seven days of discovery, in sufficient detail and with sufficient supporting documents that we can evaluate it; and (2) immediate access to the premises. Failure to comply with these conditions releases us from liability.

9. You agree that the exclusive venue for any litigation arising out of this Agreement shall be in the county where we have our principal place of business. If you fail to prove any claim against us, you agree to pay all our legal costs, expenses and attorney’s fees incurred in defending that claim. You agree that the exclusive venue for any legal action against InterNACHI itself, allegedly arising out of this Agreement or our membership in InterNACHI, will be in Boulder County, Colorado. Before bringing any such action, you must provide InterNACHI with 30 days’ written notice of the nature of the claim, in sufficient detail and with sufficient supporting documents that InterNACHI can evaluate it. In any action against us or InterNACHI, you waive trial by jury.

10. If a court declares any provision of this Agreement invalid, the remaining provisions remain in effect. This Agreement represents our entire agreement; there are no terms other than those set forth herein. All prior discussions are merged into this Agreement. No statement or promise by us shall be binding unless reduced to writing and signed by one of our authorized officers. Any modification of this Agreement must be in writing and signed by you and by one of our authorized officers. This Agreement shall be binding upon and enforceable by the parties and their heirs, executors, administrators, successors and assignees. You will have no cause of action against us after one year from the date of the inspection.

11. Past-due fees for your inspection shall accrue interest at 8% per year. You agree to pay all costs and attorney’s fees we incur in collecting the fees owed to us. If the Client is a corporation, LLC, or similar entity, you personally guarantee payment of the fee.

12. If you request a re-inspection, the re-inspection is subject to the terms of this Agreement.

13. You may not assign this Agreement.

14. If a court finds any term of this Agreement ambiguous or requiring judicial interpretation, the court shall not construe that term against us by reason of the rule that any ambiguity in a document is construed against the party drafting it. You had the opportunity to consult qualified counsel before signing this.

15. If there is more than one Client, you are signing on behalf of all of them, and you represent that you are authorized to do so.

16. If you would like a large print version of this Agreement before signing it, you may request one by emailing us.

17. If your inspector participates in InterNACHI’s Buy-Back Guarantee Program, you will be bound by the terms you may view at www.nachi.org/buy.

I HAVE CAREFULLY READ THIS AGREEMENT. I AGREE TO IT AND ACKNOWLEDGE RECEIVING A COPY OF IT.

InterNACHI® Home Inspection Agreement, revised February 2019. Copyright © 2019 International Association of Certified Home Inspectors.
`;
