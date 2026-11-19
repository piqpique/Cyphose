# Cyphose — app perso de suivi

App mobile personnelle (un seul utilisateur, pas de compte, pas de serveur) pour suivre un protocole de correction de cyphose posturale : rappels les jours de travail, séance guidée avec chronomètre, historique par semaine.

## Hypothèses à confirmer avant de coder

- Plateforme : **Expo (React Native) + TypeScript**, testé sur mon téléphone via Expo Go, puis build de développement si besoin.
- Notifications **locales** uniquement (`expo-notifications`), planifiées sur l'appareil. Pas de push serveur.
- Stockage local : `expo-sqlite`. Aucune donnée ne sort du téléphone.
- Ne pas faire de PWA : sur iPhone, une PWA ne peut pas programmer de notifications locales sans serveur push.

## 1. Types de journée

Chaque jour ouvré (lundi-vendredi) a un type, réglable depuis l'écran d'accueil :

| Type | Micro-séances proposées | Rappels |
| --- | --- | --- |
| Bureau | Set discret (assis, invisible pour les collègues) | Oui |
| Télétravail | Set complet | Oui |
| Congé | Aucune | Non |

- Un planning hebdomadaire par défaut (ex. lun/mar/jeu = bureau, mer/ven = télétravail), modifiable jour par jour.
- Samedi et dimanche : pas de rappels de micro-séances.

## 2. Rappels

- Lundi-vendredi, entre 9h00 et 17h00, toutes les 75 min par défaut (réglable de 60 à 90 min). Défaut : 9h30, 10h45, 12h00, 14h00, 15h15, 16h30.
- Plage de midi sans rappel, réglable (défaut 12h15-13h45).
- Le texte de la notification dépend du type de jour : « 2 min discrètes : menton, omoplates, dossier » (bureau) ou « Micro-séance de 3 min » (télétravail).
- Toucher la notification ouvre directement la séance correspondante.
- Actions rapides : « Fait », « Reporter 15 min », « Ignorer ».
- Rappel séparé pour la routine maison : 1 par jour, heure réglable (défaut 19h00), 7 jours sur 7.
- Replanifier toutes les notifications à chaque changement de réglage ou de type de jour. Rester sous la limite iOS de 64 notifications en attente (planifier sur 7 jours glissants).

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
- Chronomètre de tenue en grand, décompte des 3 dernières secondes, vibration courte en fin de tenue et en fin de repos. Signal sonore désactivable.
- Boutons : pause, passer l'exercice, terminer la séance.
- Écran allumé pendant la séance (`expo-keep-awake`).
- Fin de séance : durée réelle, exercices faits ou sautés, enregistrement automatique.

## 5. Suivi

Chaque séance enregistrée : date et heure, type (maison complète, maison courte, bureau, télétravail), durée, exercices faits ou sautés, origine (notification ou manuelle).

Écran Historique :
- Semaine en cours : séances maison faites sur 7 (objectif 5), micro-séances faites sur le nombre de rappels envoyés.
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

1. Accueil : type du jour, prochain rappel, bouton « Lancer la routine maison », bouton « Micro-séance maintenant », résumé de la semaine.
2. Lecteur de séance.
3. Historique.
4. Réglages : planning hebdomadaire, intervalle et plage horaire, pause de midi, heure du rappel maison, son, phase.

## 8. Critères d'acceptation

- Un jour marqué « bureau » envoie les rappels entre 9h et 17h avec le set discret, et aucun rappel pendant la pause de midi.
- Un jour « congé » et le week-end n'envoient aucun rappel de micro-séance.
- Toucher une notification ouvre la bonne séance en moins de 2 s.
- Le chronomètre reste juste si l'écran est verrouillé puis rouvert (calcul sur l'heure de début, pas sur un compteur).
- L'historique survit à la fermeture et à la mise à jour de l'app.
- Export des données en CSV depuis les réglages.

## 9. Hors périmètre

Pas de compte, pas de synchronisation cloud, pas de séances en salle, pas de tests ni de mesures de posture.
