// French for the signin screens. Keys are the exact English text passed to t()/plural().
// Covers Boot (sign-in, setup, restore, device connect, one-tab screen, lock-screen clock),
// the install card / pull-to-refresh (native.tsx), the data-safety banners and the Sync page.
export const signin: Record<string, string> = {
  // Boot: errors
  "This device is not connected to the shop yet, and the server can't be reached. Connect to the internet once to set it up.":
    "Cet appareil n'est pas encore connecté au salon et le serveur est injoignable. Connectez-vous une fois à Internet pour le configurer.",
  "Could not open the app's offline storage on this browser.":
    "Impossible d'ouvrir le stockage hors ligne de l'application dans ce navigateur.",

  // Boot: open in another tab
  "Moved to another tab": "Ouvert dans un autre onglet",
  "Already open": "Déjà ouvert",
  "You're using the shop in another tab": "Vous utilisez le salon dans un autre onglet",
  "The shop is open in another tab": "Le salon est ouvert dans un autre onglet",
  "It can only be open in one tab at a time, so no sale is ever overwritten. Your work is saved — switch here and carry on.":
    "Il ne peut être ouvert que dans un seul onglet à la fois, pour qu'aucune vente ne soit jamais écrasée. Votre travail est enregistré : basculez ici et continuez.",
  "Use here": "Utiliser ici",
  "The other tab will save and step aside.": "L'autre onglet enregistrera puis se mettra en retrait.",

  // Boot: showcase / lock-screen clock
  "Good morning, welcome to": "Bonjour, bienvenue dans",
  "Good afternoon, welcome to": "Bon après-midi, bienvenue dans",
  "Good evening, welcome to": "Bonsoir, bienvenue dans",
  "your shop": "votre salon",
  "Ready for today": "Prêt pour aujourd'hui",
  "Everyone signs in with their own PIN": "Chacun se connecte avec son propre code PIN",
  "Keeps working with no internet": "Fonctionne même sans Internet",
  "Every sale backed up": "Chaque vente sauvegardée",

  // Boot: sign-in
  "Welcome back": "Bon retour",
  "Sign in": "Se connecter",
  "Who is signing in?": "Qui se connecte ?",
  "Downloading the shop's data… make sure this device is online.":
    "Téléchargement des données du salon… vérifiez que cet appareil est connecté à Internet.",
  "Hello,": "Bonjour,",
  "Too many wrong PINs. Wait 30 seconds.": "Trop de codes PIN incorrects. Patientez 30 secondes.",
  "Wrong PIN. Try again.": "Code PIN incorrect. Réessayez.",

  // Boot: currencies
  "CFA franc (CEMAC)": "Franc CFA (CEMAC)",
  "CFA franc (UEMOA)": "Franc CFA (UEMOA)",
  "Nigerian naira": "Naira nigérian",
  "Ghanaian cedi": "Cedi ghanéen",
  "Kenyan shilling": "Shilling kényan",
  "Ugandan shilling": "Shilling ougandais",
  "Tanzanian shilling": "Shilling tanzanien",
  "Rwandan franc": "Franc rwandais",
  "South African rand": "Rand sud-africain",
  "Zambian kwacha": "Kwacha zambien",
  "Ethiopian birr": "Birr éthiopien",
  Euro: "Euro",
  "US dollar": "Dollar américain",
  "British pound": "Livre sterling",
  "Indian rupee": "Roupie indienne",

  // Boot: first-run setup
  "Set up your shop": "Configurer votre salon",
  "You'll be the owner. You can add your manager, cashier and staff next.":
    "Vous en serez le propriétaire. Vous pourrez ensuite ajouter votre gérant, votre caissier et votre personnel.",
  "Shop name": "Nom du salon",
  "Your name": "Votre nom",
  Currency: "Devise",
  "All amounts in the app use this currency.": "Tous les montants de l'application utilisent cette devise.",
  "Owner PIN": "Code PIN du propriétaire",
  "4–6 digits": "4 à 6 chiffres",
  "Repeat PIN": "Confirmer le code PIN",
  "Create shop": "Créer le salon",
  "Restore a shop from a backup file": "Restaurer un salon à partir d'une sauvegarde",
  "Your PIN must be 4 to 6 digits.": "Votre code PIN doit comporter 4 à 6 chiffres.",
  "The two PINs don't match.": "Les deux codes PIN ne correspondent pas.",
  "Setup failed.": "La configuration a échoué.",

  // Boot: connect a device
  "Connect this phone or computer to the shop. After this it works offline too, and everyone signs in with their own PIN.":
    "Connectez ce téléphone ou cet ordinateur au salon. Ensuite, il fonctionnera aussi hors ligne et chacun se connectera avec son propre code PIN.",
  "Could not connect this device.": "Impossible de connecter cet appareil.",

  // Boot: restore from a backup
  "Restore from a backup": "Restaurer une sauvegarde",
  "Use this on a new or empty server to bring the whole shop back: sales, staff, pay, expenses, clients and logins. Choose the newest backup you have.":
    "À utiliser sur un serveur neuf ou vide pour récupérer tout le salon : ventes, personnel, paie, dépenses, clients et accès. Choisissez la sauvegarde la plus récente dont vous disposez.",
  "Choose backup file (.sqlite)": "Choisir le fichier de sauvegarde (.sqlite)",
  "PIN of {name}": "Code PIN de {name}",
  "The owner's PIN from when this backup was made.": "Le code PIN du propriétaire au moment de la sauvegarde.",
  "Restore shop": "Restaurer le salon",
  "{n} sale, latest {date}": "{n} vente, la dernière le {date}",
  "{n} sales, latest {date}": "{n} ventes, la dernière le {date}",
  "{n} staff member": "{n} employé",
  "{n} staff members": "{n} employés",
  "Includes {n} change that never reached the old server. It will be sent too.":
    "Contient {n} modification qui n'a jamais atteint l'ancien serveur. Elle sera également envoyée.",
  "Includes {n} changes that never reached the old server. They will be sent too.":
    "Contient {n} modifications qui n'ont jamais atteint l'ancien serveur. Elles seront également envoyées.",
  "This backup has no owner account, so it can't be restored.":
    "Cette sauvegarde ne contient aucun compte propriétaire : elle ne peut pas être restaurée.",
  "Could not read that file.": "Impossible de lire ce fichier.",
  "That PIN doesn't match the owner in this backup.": "Ce code PIN ne correspond pas au propriétaire de cette sauvegarde.",
  "Reading the backup…": "Lecture de la sauvegarde…",
  "Uploading records… {pct}%": "Envoi des données… {pct} %",
  "Checking the owner PIN…": "Vérification du code PIN du propriétaire…",
  "Connecting this device…": "Connexion de cet appareil…",
  "Downloading the shop to this device…": "Téléchargement du salon sur cet appareil…",
  "Restore failed ({status}).": "La restauration a échoué ({status}).",
  "Restore failed.": "La restauration a échoué.",

  // native.tsx: install card
  "Install the app": "Installer l'application",
  Tap: "Touchez",
  "then “Add to Home Screen”.": "puis « Sur l'écran d'accueil ».",
  "Opens full screen from your home screen, even offline.": "S'ouvre en plein écran depuis votre écran d'accueil, même hors ligne.",
  Install: "Installer",
  Dismiss: "Masquer",

  // DataSafety.tsx
  "Not saved on this device": "Non enregistré sur cet appareil",
  "Everything has reached the server, so nothing is lost.": "Tout est arrivé sur le serveur : rien n'est perdu.",
  "{n} change only on this device": "{n} modification uniquement sur cet appareil",
  "{n} changes only on this device": "{n} modifications uniquement sur cet appareil",
  "Waiting since {date}. They are saved here, but connect to the internet soon so they are also kept safely on the server. Don't clear this browser's data or uninstall the app until they upload.":
    "En attente depuis le {date}. Elles sont enregistrées ici, mais connectez-vous bientôt à Internet pour qu'elles soient aussi conservées en sécurité sur le serveur. N'effacez pas les données de ce navigateur et ne désinstallez pas l'application avant leur envoi.",
  "This device's copy was repaired": "La copie de cet appareil a été réparée",
  "The shop was restored from a backup": "Le salon a été restauré à partir d'une sauvegarde",
  "See backups": "Voir les sauvegardes",
  "The saved file was damaged, so everything is being downloaded again from the server.":
    "Le fichier enregistré était endommagé : tout est en cours de retéléchargement depuis le serveur.",
  "The saved file was damaged, so the copy from {date} was loaded and newer changes are coming back from the server.":
    "Le fichier enregistré était endommagé : la copie du {date} a été chargée et les modifications plus récentes reviennent du serveur.",
  "This device downloaded the restored data. Its previous copy was kept as an archive under Backup & export.":
    "Cet appareil a téléchargé les données restaurées. Son ancienne copie a été conservée comme archive dans Sauvegarde et export.",

  // SyncView.tsx
  Sync: "Synchronisation",
  "This device: {code}": "Cet appareil : {code}",
  Status: "État",
  "Up to date": "À jour",
  "Offline — changes are saved on this device": "Hors ligne — les modifications sont enregistrées sur cet appareil",
  Problem: "Problème",
  "Waiting to upload": "En attente d'envoi",
  "Last synced": "Dernière synchronisation",
  "Not yet this session": "Pas encore pendant cette session",
  "Sync now": "Synchroniser maintenant",
  "Everything is saved on this device first, so the shop keeps working without internet. Changes upload automatically when the connection is back.":
    "Tout est d'abord enregistré sur cet appareil, pour que le salon continue de fonctionner sans Internet. Les modifications sont envoyées automatiquement dès le retour de la connexion.",
  "Changes the server refused": "Modifications refusées par le serveur",
  "Usually this means someone's access was changed while this device was offline. Re-download to make this device match the server, then redo anything that's still needed.":
    "Cela signifie généralement que les accès d'une personne ont été modifiés pendant que cet appareil était hors ligne. Retéléchargez les données pour aligner cet appareil sur le serveur, puis refaites ce qui est encore nécessaire.",
  "Re-download shop data": "Retélécharger les données du salon",
  "Re-download shop data?": "Retélécharger les données du salon ?",
  "Re-download": "Retélécharger",
  "This device's copy is replaced with the server's. Changes still waiting to upload are kept and sent first. Refused changes are cleared.":
    "La copie de cet appareil est remplacée par celle du serveur. Les modifications en attente d'envoi sont conservées et envoyées en premier. Les modifications refusées sont effacées.",
  // Sync: kinds of refused change
  Sale: "Vente",
  Expense: "Dépense",
  "Staff change": "Modification du personnel",
  "Price change": "Modification de prix",
  "Product change": "Modification de produit",
  "Stock change": "Mouvement de stock",
  "Day close": "Clôture de la journée",
  "Month close": "Clôture du mois",
  "User change": "Modification d'utilisateur",
  "Staff advance/bonus": "Avance/prime du personnel",
  "Staff payment": "Paiement du personnel",
  // Sync log: names of actions waiting or refused.
  "Sale cancellation": "Annulation de vente",
  "Expense cancellation": "Annulation de dépense",
  // The iPhone Share button in the install hint (not a staff "share").
  "Share button": "Partager",
};
