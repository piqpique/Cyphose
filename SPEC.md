# Cyphose — app perso de suivi

App mobile personnelle (un seul utilisateur, pas de compte, pas de serveur) pour suivre un protocole de correction de cyphose posturale : rappels les jours de travail, séance guidée avec chronomètre, historique par semaine.

## Choix techniques

- Plateforme : **PWA** (Vite + TypeScript, sans framework), installée sur l'iPhone via Safari → Partager → « Sur l'écran d'accueil ». Hébergée gratuitement sur GitHub Pages (`https://piqpique.github.io/Cyphose/`), fonctionne hors ligne grâce au service worker.
- Raison : pas de Mac ni de compte Apple Developer payant. Une app Expo ne peut pas tourner au quotidien sans l'un des deux.
- Conséquence : une PWA iOS ne peut pas programmer de notifications locales. Les rappels sont délégués au **Calendrier iOS** via un fichier `.ics` généré par l'app (voir section 2).
- Stockage local : IndexedDB, avec demande de stockage persistant (`navigator.storage.persist()`). Aucune donnée ne sort du téléphone. L'export CSV sert de sauvegarde.
- Le dépôt est public : n'y mettre aucune donnée personnelle (ni export CSV, ni historique).

## 1. Types de journée

Chaque jour ouvré (lundi-vendredi) a un type, réglable depuis l'écran d'accueil :

| Type | Micro-séances proposées | Rappels |
| --- | --- | --- |
| Bureau | Set discret (assis, invisible pour les collègues) | Oui |
| Télétravail | Set complet | Oui |
| Congé | Aucune | Non |

- Un planning hebdomadaire par défaut (ex. lun/mar/jeu = bureau, mer/ven = télétravail), modifiable jour par jour.
- Samedi et dimanche : pas de rappels de micro-séances.

## 2. Rappels (via le Calendrier iOS)

L'app calcule les créneaux et génère un fichier `.ics` à importer une fois dans le Calendrier iOS. Ce sont les alertes du calendrier qui servent de notifications.

- Créneaux de micro-séances : lundi-vendredi, entre 9h00 et 17h00, toutes les 75 min par défaut (réglable de 60 à 90 min). Défaut : 9h30, 10h45, 12h00, 14h00, 15h15, 16h30.
- Plage de midi sans créneau, réglable (défaut 12h15-13h45).
- Un événement récurrent hebdomadaire par créneau et par jour, selon le planning par défaut, avec une alerte à l'heure de l'événement.
- Titre de l'événement selon le type du jour : « 2 min discrètes : menton, omoplates, dossier » (bureau) ou « Micro-séance de 3 min » (télétravail).
- Chaque événement contient le lien vers la bonne séance (`…/Cyphose/?seance=bureau&origine=rappel`).
- Rappel séparé pour la routine maison : 1 événement par jour, heure réglable (défaut 19h00), 7 jours sur 7.
- Après un changement de planning ou d'horaires, l'app propose de régénérer le fichier. L'utilisateur supprime l'ancien calendrier et importe le nouveau. L'app explique ces étapes à l'écran.
- Jours de congé ponctuels : l'app ne peut pas couper les alertes. L'utilisateur les ignore ou active un mode Concentration. L'écran d'accueil affiche quand même « Congé, pas de micro-séance ».
- Hors périmètre (impossibles en PWA iOS) : actions rapides « Fait / Reporter / Ignorer » sur la notification, rappels qui s'adaptent automatiquement au type du jour.

À vérifier sur l'iPhone dès la première version : le lien d'un événement ouvre-t-il l'app installée ou Safari ? Si c'est Safari, l'historique n'y est pas partagé avec l'app installée : la séance doit alors être lancée depuis l'app.

## 3. Séances et exercices

Les exercices sont des données (fichier `exercises.ts`), pas du code en dur. Chaque exercice a : id, nom, illustration (SVG fourni dans `assets/illustrations/`), consignes (3-4 lignes courtes), erreur à éviter, type de dose, dose par phase.

Types de dose à gérer par le chronomètre :
- **Tenues** : n répétitions × tenue de x s, repos de y s entre deux (ex. cobra 10 × 5 s, repos 5 s).
- **Répétitions par côté** : n répétitions côté gauche, puis annonce « change de côté ».
- **Tenue simple** : x s, éventuellement × côtés × positions (ex. porte 30 s × 2 hauteurs × 2 côtés).
- **Respirations** : n cycles inspire 4 s / expire 6 s, avec guidage visuel.
- **Séries** : nombre de séries et repos entre séries (défaut 30 s).

### Routine maison complète (18 min)

| # | Exercice | Illustration | Dose |
| --- | --- | --- | --- |
| 1 | Respiration 90/90, menton rentré | resp.svg | 2 × 5 respirations (4 s / 6 s) |
| 2 | Extension sur rouleau | rouleau.svg | 3 niveaux × 5, tenue 3 s |
| 3 | Open book | openbook.svg | 8 par côté, tenue 2 s |
| 4 | Y-T-W à plat ventre | ytw.svg | 2 tours × 8 par lettre, tenue 3 s |
| 5 | Cobra thoracique | cobra.svg | 2 × 10, tenue 5 s, repos 5 s |
| 6 | Anges au mur | anges.svg | 2 × 8, 4 s montée / 4 s descente |
| 7 | Étirement à la porte | porte.svg | 30 s × 2 hauteurs × 2 côtés |
| 8 | Auto-élongation debout | elong.svg | 5 × 20 s |

### Routine maison courte (8 min)

1 × 5 respirations · rouleau 3 niveaux × 3 · Y-T-W 1 tour · cobra 1 × 10 · auto-élongation 3 × 20 s. Les exercices 4 et 5 ne sont jamais supprimés.

### Micro-séance bureau, set discret (2 min, assis)

| Exercice | Illustration | Dose |
| --- | --- | --- |
| B3. Menton rentré, omoplates dans les poches | menton.svg | 8 × 5 s |
| B1. Extension sur le dossier (sans les mains derrière la tête : mains sur les cuisses) | dossier.svg | 5 × 3 s |
| B5. Rotation assise | rotation.svg | 5 par côté |
| B7. Auto-élongation assise | elong.svg | 20 s |

### Micro-séance télétravail (3 min)

Un exercice par famille, en rotation automatique d'une séance à l'autre :
- Extension : B1 dossier (5 × 3 s) ou B2 appui sur le bureau (bureau.svg, 5 × 5 s)
- Contrôle : B3 (8 × 5 s) ou B4 anges au mur (anges.svg, 6 à 8)
- Rotation / étirement : B5 (5 par côté) ou B6 porte (porte.svg, 2 min, une seule fois par jour)
- Toujours finir par B7 (20 s).

## 4. Lecteur de séance

- Un écran par exercice : illustration en grand, nom, 3 consignes, compteur (« répétition 4/10 », « côté droit », « série 2/2 »).
- Chronomètre de tenue en grand, décompte des 3 dernières secondes, signal sonore court (Web Audio) et flash visuel en fin de tenue et en fin de repos. Son désactivable. Pas de vibration : Safari iOS ne gère pas l'API Vibration.
- Boutons : pause, passer l'exercice, terminer la séance.
- Écran allumé pendant la séance (Screen Wake Lock API ; à vérifier en mode écran d'accueil sur la version d'iOS de l'iPhone).
- Fin de séance : durée réelle, exercices faits ou sautés, enregistrement automatique.

## 5. Suivi

Chaque séance enregistrée : date et heure, type (maison complète, maison courte, bureau, télétravail), durée, exercices faits ou sautés, origine (lien d'un rappel ou lancement manuel).

Écran Historique :
- Semaine en cours : séances maison faites sur 7 (objectif 5), micro-séances faites sur le nombre de créneaux prévus (calculé depuis le planning, hors jours marqués congé).
- Graphique par semaine depuis le début : barres « maison » et « micro-séances ».
- Série de jours consécutifs avec une routine maison.
- Total par exercice.

## 6. Progression par phases

Phase courante affichée sur l'accueil. Les doses de la séance dépendent de la phase.

| Phase | Semaines | Contenu | Critère de passage (case à cocher par l'utilisateur) |
| --- | --- | --- | --- |
| 1. Apprentissage | 1-4 | Doses ci-dessus, poids du corps | Y-T-W et cobra sans cambrer ni hausser les épaules, sans douleur |
| 2. Renforcement | 5-12 | Y-T-W 12 par lettre, puis tenue 5 s, puis 0,5 kg ; version courte autorisée 2 j/semaine | Y-T-W 2 × 12, 5 s, 0,5 kg ; cobra 2 × 10 bras tendus en Y |
| 3. Intégration | 13-24 | Routine complète 5 j/7, variantes les plus dures | Posture redressée tenue sans y penser |
| 4. Entretien | après 24 | Version courte 3-4 fois/semaine | Retour en phase 2 si le dos s'arrondit à nouveau |

L'app propose le passage de phase quand la durée minimale est atteinte. C'est l'utilisateur qui valide le critère.

## 7. Écrans

1. Accueil : type du jour, prochain créneau, bouton « Lancer la routine maison », bouton « Micro-séance maintenant », résumé de la semaine.
2. Lecteur de séance.
3. Historique.
4. Réglages : planning hebdomadaire, intervalle et plage horaire, pause de midi, heure du rappel maison, son, phase, génération du fichier `.ics`, export CSV.

## 8. Critères d'acceptation

- Le fichier `.ics` généré pour un planning donné contient les créneaux bureau ou télétravail entre 9h et 17h, aucun pendant la pause de midi, aucun le week-end, et le rappel maison 7 j/7 (testé automatiquement).
- Un jour marqué « congé » n'est pas compté dans les créneaux prévus de l'historique.
- Ouvrir `?seance=<type>` lance directement la bonne séance.
- Le chronomètre reste juste si l'écran est verrouillé puis rouvert (calcul sur l'heure de début, pas sur un compteur).
- L'historique survit à la fermeture de l'app et à une nouvelle version de l'app.
- L'app installée fonctionne en mode avion.
- Export des données en CSV depuis les réglages.

## 9. Hors périmètre

Pas de compte, pas de serveur, pas de notifications push, pas de synchronisation cloud, pas de séances en salle, pas de tests ni de mesures de posture.
