<div align="center">

# 📊 Engineering Rebalance & Capacity Planning Tool

**Enterprise-grade interactive simulation tool designed for engineering leaders to manage team capacity, quarterly rotation planning, and resource rebalancing.**

[![CI & Deploy](https://github.com/FedeRamundo25/rebalance-tool/actions/workflows/ci.yml/badge.svg)](https://github.com/FedeRamundo25/rebalance-tool/actions/workflows/ci.yml)
[![Live Demo](https://img.shields.io/badge/demo-online-brightgreen?style=flat-square&logo=github)](https://federamundo25.github.io/rebalance-tool/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

[**Explorar Demo en Vivo**](https://federamundo25.github.io/rebalance-tool/)

</div>

---

## 🚀 Sobre el Proyecto

La **Engineering Rebalance Tool** resuelve desafíos organizacionales complejos en entornos de ingeniería de alto crecimiento. Permite realizar un seguimiento transparente de la capacidad, modelos de mitigación de riesgos para rotaciones de squads y análisis orientados a datos para alinear la asignación de talento técnico con los hitos trimestrales estratégicos.

---

## 🛠️ Stack Tecnológico

* **Frontend**: Vanilla JavaScript (ESModules), Arquitectura Modular por Componentes.
* **Estilos**: Tailwind CSS para un diseño moderno y responsivo.
* **Bundler & Build**: Vite.
* **Testing**: 
  * **Unitario**: Vitest (`tests/unit/`)
  * **E2E (End-to-End)**: Playwright (`tests/e2e/`)
* **CI/CD**: GitHub Actions (Integración continua, validación de tests, empaquetado y despliegue automático en GitHub Pages).

---

## 📐 Capacidades Clave

1. **Tablero Kanban Interactivo**: Gestión visual de flujos de trabajo adaptada para movimientos de equipos de ingeniería y reasignación de capacidad.
2. **Selección de Hitos (Milestones)**: Selectores de roadmap trimestral para proyectar límites de capacidad y detectar cuellos de botella.
3. **Calidad Automatizada (Quality Gates)**: Pipeline robusto que garantiza el pase exitoso de todas las pruebas antes de cada despliegue a producción.

---

## ⚙️ Instalación y Ejecución Local

Si deseas clonar el repositorio y correrlo localmente:

```bash
# 1. Clonar el repositorio
git clone [https://github.com/FedeRamundo25/rebalance-tool.git](https://github.com/FedeRamundo25/rebalance-tool.git)

# 2. Entrar al directorio
cd rebalance-tool

# 3. Instalar dependencias
npm ci
