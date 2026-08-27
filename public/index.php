<?php
declare(strict_types=1);
session_start();
require_once __DIR__ . '/../app/Helpers/Auth.php';
require_once __DIR__ . '/../app/Helpers/Csrf.php';
use SAMS\Helpers\Auth;
use SAMS\Helpers\Csrf;
if (!Auth::check()) { header('Location: ./login.php'); exit; }
$user = Auth::user();
$csrf = Csrf::token();
?>
<!doctype html>
<html lang="fr" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#0d1117">
<meta name="csrf-token" content="<?= htmlspecialchars($csrf, ENT_QUOTES, 'UTF-8') ?>">
<title>SAMS — Student Attendance Management System</title>
<link rel="stylesheet" href="assets/css/style.css">
</head>
<body>
<header class="topbar">
  <div class="brand"><div class="brand-icon">🏫</div><div><strong>SAMS</strong><small>Student Attendance Management System</small></div></div>
  <div class="user-area"><span id="currentUser"><?= htmlspecialchars((string)$user['full_name'], ENT_QUOTES, 'UTF-8') ?></span><button id="themeBtn" class="btn ghost" type="button">🌙</button><button id="logoutBtn" class="btn danger" type="button">Déconnexion</button></div>
</header>
<main class="app-shell">
<section class="toolbar">
  <div class="toolbar-left">
    <label>Classe<select id="classSelect"></select></label>
    <label>Semaine<input id="weekStart" type="date"></label>
    <button id="reloadBtn" class="btn primary" type="button">Actualiser</button>
  </div>
  <div class="toolbar-right"><button id="addClassBtn" class="btn success admin-only" type="button">+ Classe</button><button id="printBtn" class="btn" type="button">Imprimer</button></div>
</section>
<section class="stats" aria-label="Statistiques"><article><span>Présences</span><strong id="statPresent">0</strong></article><article><span>Absences</span><strong id="statAbsent">0</strong></article><article><span>Retards / excusés</span><strong id="statOther">0</strong></article><article><span>Taux de présence</span><strong id="statRate">0%</strong></article></section>
<nav class="tabs" aria-label="Navigation"><button class="tab active" data-tab="attendance" type="button">Absence</button><button class="tab" data-tab="students" type="button">Élèves</button><button class="tab" data-tab="statistics" type="button">Statistiques</button><button class="tab" data-tab="signature" type="button">Signature</button></nav>
<section class="panel" data-panel="attendance">
  <div class="panel-head"><div><h1>Feuille de présence hebdomadaire</h1><p>Un clic = présent · Double-clic = absent · Cliquez à nouveau pour effacer</p></div><input id="studentSearch" type="search" placeholder="Rechercher un élève…" autocomplete="off"></div>
  <div class="filters"><button class="filter active" data-filter="all" type="button">Tous</button><button class="filter" data-filter="risk" type="button">À risque</button><button class="filter" data-filter="committed" type="button">Assidus</button></div>
  <div class="table-scroll"><table id="attendanceTable"><thead id="attendanceHead"></thead><tbody id="attendanceBody"></tbody></table></div>
</section>
<section class="panel hidden" data-panel="students"><div class="panel-head"><div><h1>Élèves de la classe</h1><p id="studentCount">0 élève</p></div><button class="btn success" id="addStudentBtn" type="button">+ Élève</button></div><div class="students-list" id="studentsList"></div></section>
<section class="panel hidden" data-panel="statistics"><div class="panel-head"><div><h1>Analyse de la semaine</h1><p>Les indicateurs sont calculés à partir des données MySQL.</p></div></div><div class="statistics-grid" id="statisticsGrid"></div></section>
<section class="panel hidden" data-panel="signature"><div class="panel-head"><div><h1>Signature de l'enseignant</h1><p>Enregistrez une signature pour la classe active.</p></div></div><div class="signature-panel"><canvas id="signatureCanvas" width="900" height="320"></canvas><div class="signature-actions"><button class="btn" id="clearSignatureBtn" type="button">Effacer</button><button class="btn primary" id="saveSignatureBtn" type="button">Enregistrer</button></div></div></section>
</main>
<dialog id="studentDialog"><form method="dialog" id="studentForm"><h2>Ajouter un élève</h2><label>Prénom<input id="firstNameInput" required maxlength="80"></label><label>Nom<input id="lastNameInput" required maxlength="80"></label><label>N° élève<input id="studentNumberInput" maxlength="30"></label><div class="dialog-actions"><button class="btn" value="cancel">Annuler</button><button class="btn primary" id="saveStudentBtn" value="default">Ajouter</button></div></form></dialog>
<dialog id="classDialog"><form method="dialog" id="classForm"><h2>Créer une classe</h2><label>Nom<input id="classNameInput" required maxlength="100"></label><label>Niveau<input id="classLevelInput" maxlength="50"></label><label>Branche<input id="classBranchInput" maxlength="100"></label><div class="dialog-actions"><button class="btn" value="cancel">Annuler</button><button class="btn primary" id="saveClassBtn" value="default">Créer</button></div></form></dialog>
<div id="toast" class="toast" role="status" aria-live="polite"></div>
<script type="module" src="assets/js/app.js"></script>
</body>
</html>
