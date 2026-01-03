# Fallout 2d20 – webová karta postavy (GitHub Pages)

Tahle mini-aplikace je čistě statická (HTML/CSS/JS) a vizuálně používá jako pozadí dvě stránky PDF (exportované do PNG).
Všechna „PDF políčka“ na straně 1 + vybraná políčka na straně 2 jsou překreslená jako webové inputy ve stejné pozici.
Sekce **Zbraně; Munice; Vybavení; Perky a rysy** jsou udělané jako dynamické seznamy (přidat/odebrat řádky).

> Poznámka: ukládání na GitHub probíhá přes GitHub API a vyžaduje osobní token (PAT). Token se ukládá pouze do `localStorage` ve tvém prohlížeči.

## Jak to nasadit

1) Vytvoř nový veřejný repo na GitHubu (např. `fallout-sheet`).
2) Nahraj do něj obsah této složky (root repo).
3) V repo nastav GitHub Pages:
   - Settings → Pages → „Deploy from a branch“
   - Branch: `main` (root)
4) Otevři stránku na `https://<tvůj-uživatel>.github.io/<repo>/`

## Jak nastavit ukládání (PAT)

1) Na GitHubu vytvoř Personal Access Token:
   - Settings → Developer settings → Personal access tokens (classic nebo fine-grained)
   - Musí mít práva zapisovat do repa (u veřejného repa stačí „Contents: Read and write“ / nebo u classic scope `public_repo`).
2) Ve webu vlož token do pole „GitHub token (PAT) pro ukládání“ a klikni „Zapamatovat token“.

⚠️ Token nikdy necommituj do repozitáře.

## Admin lišta

- **Vytvořit novou postavu**: vyčistí formulář
- **Vybrat postavu**: načte z GitHubu
- **Upravit postavu (uložit změny)**: uloží JSON na GitHub (vyžaduje heslo)
- **Vymazat vybranou postavu**: smaže JSON z GitHubu (vyžaduje heslo)

### Heslo
Heslo je **první slovo jména postavy** (Strana 1, pole „JMÉNO POSTAVY“), malými písmeny.

> Upozornění: je to pouze „měkká“ ochrana v klientu. Není to bezpečnostní mechanismus proti někomu, kdo umí JS/DevTools.
Skutečná bezpečnost by vyžadovala server nebo OAuth flow (můžu to navrhnout, pokud budeš chtít).

## Data

- Postavy jsou v `data/characters/<id>.json`
- Seznam postav je v `data/characters/index.json`
