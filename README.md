# Soulbound (prototype)

Extension Owlbear Rodeo : les données des tokens (PV, sorts, fiches… de n'importe quelle extension
qui les range dans les metadata de l'item) survivent à la suppression du token et au changement de scène.

- **Persistant** (clic droit → « Soulbound : rendre persistant ») : un PJ ou un PNJ nommé. Ses données sont
  sauvegardées à chaque changement. Un token posé avec la même image et le même nom les retrouve seul ;
  avec la même image seulement, le panneau propose de les lui rendre.
- **Modèle** (clic droit → « Soulbound : en faire le modèle ») : les données de départ de tous les tokens
  d'une image. Cinq rats posés reçoivent chacun le modèle, puis ont leurs propres PV.

## Stockage

| Où | Rôle |
|---|---|
| Metadata de la scène ouverte | Source de vérité, une clé par entrée (`soulbound/e/…`), recopiée dans chaque scène ouverte |
| Metadata de la room (`soulbound/journal`, ≤ 10 Ko) | Derniers changements + date du plus récent, pour détecter une copie en retard |
| `localStorage` du MJ (`soulbound/cache/<room>`) | Cache de secours |
| Export JSON | Filet manuel |

Fusion entrée par entrée, la plus récente gagne ; une entrée supprimée reste en pierre tombale.
Un seul MJ agit (le plus petit identifiant de connexion), les autres tiennent leur cache à jour.

## Développement

```sh
pnpm install
pnpm dev     # http://localhost:5176/manifest.json à ajouter dans Owlbear
pnpm test
pnpm build
```
