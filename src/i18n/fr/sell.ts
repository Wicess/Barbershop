// French for the sell screens. Keys are the exact English text passed to t()/plural().
// Shared words (Save, Total, Remove, Done, Cash, Cashier, Staff…) live in common.ts / core.ts.
export const sell: Record<string, string> = {
  // Till: header, empty states, sections, tiles
  "New sale": "Nouvelle vente",
  "Tap what the customer had. Services ask who did them.":
    "Touchez ce que le client a pris. Pour chaque prestation, on vous demande qui l'a réalisée.",
  "Your price list is empty": "Votre liste de tarifs est vide",
  "Add services and drinks": "Ajouter des prestations et des boissons",
  "Add your services (haircut, shave, pedicure…) and drinks first.":
    "Ajoutez d'abord vos prestations (coupe, rasage, pédicure…) et vos boissons.",
  "Ask the manager or owner to add the price list.": "Demandez au gérant ou au propriétaire d'ajouter la liste des tarifs.",
  "No staff added yet": "Aucun employé pour l'instant",
  "Add staff": "Ajouter du personnel",
  "Each service is credited to the barber or technician who did it, so add your staff first.":
    "Chaque prestation est attribuée au coiffeur ou à la technicienne qui l'a réalisée : ajoutez d'abord votre personnel.",
  Sections: "Sections",
  "Nothing in {section} yet.": "Rien dans « {section} » pour l'instant.",
  "Out of stock": "En rupture",
  "{n} left": "Reste : {n}",
  "{n} on ticket": "{n} sur le ticket",

  // Ticket
  Ticket: "Ticket",
  "Ticket · {n} item": "Ticket · {n} article",
  "Ticket · {n} items": "Ticket · {n} articles",
  "No items yet. Tap a service or drink.": "Aucun article pour l'instant. Touchez une prestation ou une boisson.",
  "by {name}": "par {name}",
  "price changed": "prix modifié",
  "Who gets what": "Qui reçoit quoi",
  "Shop keeps": "Part du salon",
  "Customer phone": "Téléphone du client",
  Optional: "Facultatif",
  "Walk-in": "Client de passage",
  Discounts: "Remises",
  Clear: "Vider",
  Charge: "Encaisser",
  "Charge {amount}": "Encaisser {amount}",
  "View ticket": "Voir le ticket",

  // Staff picker
  "Who did the {service}?": "Qui a réalisé : {service} ?",
  "Done by": "Réalisé par",
  "{rate} share": "Part : {rate}",

  // Line editor
  Quantity: "Quantité",
  "One less": "Un de moins",
  "One more": "Un de plus",
  "Price (each)": "Prix (unitaire)",
  "Changed from the price list. This is recorded.": "Différent de la liste des tarifs. Cette modification est enregistrée.",
  Discount: "Remise",
  "Taken off this item. Staff share is calculated after the discount.":
    "Déduite de cet article. La part de l'employé est calculée après la remise.",

  // Pay sheet
  "Complete sale": "Valider la vente",
  Tip: "Pourboire",
  "No tip": "Sans pourboire",
  "Tip amount": "Montant du pourboire",
  "Goes 100% to the person you pick, on top of the bill. It is added to their pay, not to the shop's sales.":
    "Revient à 100 % à la personne choisie, en plus de la note. Il s'ajoute à sa paie, pas au chiffre d'affaires du salon.",
  "Who gets it": "Qui le reçoit",
  "Pick who gets the tip.": "Choisissez qui reçoit le pourboire.",
  "Add a tip": "Ajouter un pourboire",
  "Bill {bill} + tip {tip}": "Note {bill} + pourboire {tip}",
  "Payment {n}": "Paiement {n}",
  "Payment method": "Mode de paiement",
  "Transaction code": "Code de transaction",
  "Reference (optional)": "Référence (facultatif)",
  "Check it on the shop's till statement, not the customer's SMS.":
    "Vérifiez-le sur le relevé du compte du salon, pas sur le SMS du client.",
  "Fully covered": "Entièrement réglé",
  "Still to pay": "Reste à payer",
  "Too much": "Trop perçu",
  "Split payment": "Paiement fractionné",
  "Cash received": "Montant reçu en espèces",
  "Less than the cash due.": "Inférieur au montant dû en espèces.",
  Exact: "Montant exact",
  "Give change": "Monnaie à rendre",

  // Returning client
  "Returning client": "Client habitué",
  "{name} · visit {n}": "{name} · {n}e visite",
  "Last came {date}": "Dernière visite le {date}",
  "usually {name}": "habituellement {name}",
  "last served by {names}": "dernièrement servi par {names}",
  "likes {items}": "aime {items}",
  "last had {items}": "a pris dernièrement {items}",

  // Sale complete
  "Sale recorded · {receipt}": "Vente enregistrée · {receipt}",
  "Change to give": "Monnaie à rendre",
  "Print receipt": "Imprimer le reçu",
  "Next customer": "Client suivant",

  // Printed receipt
  "Tel: {phone}": "Tél. : {phone}",
  Receipt: "Reçu",
  Customer: "Client",
  "*** VOIDED: {reason} ***": "*** ANNULÉ : {reason} ***",
  Subtotal: "Sous-total",
  TOTAL: "TOTAL",
  "Tip for {name}": "Pourboire pour {name}",
  PAID: "PAYÉ",
  Change: "Monnaie rendue",

  // Who gets what (split card)
  "Shop · {rate}": "Salon · {rate}",
  "adds up": "équilibré",
  "Tip for {name} (100%)": "Pourboire pour {name} (100 %)",
  "Customer paid": "Payé par le client",
};
