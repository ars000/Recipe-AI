# Web

This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 18.2.0.

## Стили

- `src/styles/_variables.scss` — единый источник цветов (Sass `$…` + CSS `var(--…)` на `:root`), тени, градиенты hero/плиток, шрифты.
- `src/styles/_breakpoints.scss` — `sm` 576, `md` 768, `lg` 992, `xl` 1200, `xxl` 1400; `$container-max-width` (= xl). В SCSS: `@use '…/breakpoints' as *;` → `@include media("min", "lg") { … }` (`"max"`, `"within"`).
- `src/styles/_material-theme.scss` — тема Angular Material.
- `src/styles/_ui-patterns.scss` — общие блоки layout (hero, recipe-grid, category tiles и т.д.), подключаются из `styles.scss`. Стили конкретных компонентов лежат рядом с `*.component.scss` / `*.page.scss`.

Страницы и shared-компоненты — **каждый в своей папке** (`features/home/home/home.page.*`, `shared/ui/recipe-card/recipe-card.component.*`), с отдельными `*.html` и `*.scss` (`templateUrl` / `styleUrl`).

Имена CSS-классов — **BEM**: блок `recipe-card`, элемент `recipe-card__body`, модификатор `btn--accent`, `category-tile--products`.

## Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The application will automatically reload if you change any of the source files.

## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory.

## Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

## Running end-to-end tests

Run `ng e2e` to execute the end-to-end tests via a platform of your choice. To use this command, you need to first add a package that implements end-to-end testing capabilities.

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
