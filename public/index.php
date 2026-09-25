<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/app/bootstrap.php';

use SAMS\Helpers\Auth;
use SAMS\Helpers\Csrf;

if (!Auth::check()) {
    header('Location: login.php', true, 302);
    exit;
}

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
    <title>SAMS — Gestion des absences</title>
    <link rel="stylesheet" href="assets/css/style.css">
    <link rel="stylesheet" href="assets/css/print.css">
</head>
<body>
<header class="topbar">
    <div class="brand">
        <div class="brand-icon" aria-hidden="true">🏫</div>
        <div><strong>SAMS</strong><small>Student Attendance Management System</small></div>
    </div>
    <div class="user-area">
        <span id="currentUser"><?= htmlspecialchars((string)$user['full_name'], ENT_QUOTES, 'UTF-8') ?></span>
        <button id="themeBtn" class="btn ghost" type="button" aria-label="Changer le thème">🌙</button>
        <button id="logoutBtn" class="btn danger" type="button">Déconnexion</button>
    </div>
</header>

<main class="app-shell">
    <section class="toolbar" aria-label="Filtres principaux">
        <div class="toolbar-left">
            <label>Classe<select id="classSelect" aria-label="Classe"></select></label>
            <label>Mois<input id="monthSelect" type="month" aria-label="Mois"></label>
            <button id="reloadBtn" class="btn primary" type="button">Actualiser</button>
        </div>
        <div class="toolbar-right">
            <button id="addClassBtn" class="btn success admin-only" type="button">+ Classe</button>
            <button id="reportBtn" class="btn" type="button">Rapport</button>
        </div>
    </section>

    <section class="stats" aria-label="Statistiques">
        <article><span>Présences</span><strong id="statPresent">0</strong></article>
        <article><span>Absences</span><strong id="statAbsent">0</strong></article>
        <article><span>Retards / excusés</span><strong id="statOther">0</strong></article>
        <article><span>Taux de présence</span><strong id="statRate">0%</strong></article>
    </section>

    <nav class="tabs" aria-label="Navigation principale">
        <button class="tab active" data-tab="attendance" type="button">Absence</button>
        <button class="tab" data-tab="students" type="button">Élèves</button>
        <button class="tab" data-tab="statistics" type="button">Statistiques</button>
        <button class="tab" data-tab="signature" type="button">Signature</button>
        <button class="tab" data-tab="archive" type="button">Archive</button>
        <button class="tab admin-only" data-tab="admin" type="button">Administration</button>
    </nav>

    <section class="panel" data-panel="attendance">
        <div class="panel-head">
            <div>
                <h1>Feuille mensuelle de présence</h1>
                <p>1 clic = présent · double-clic = absent · clic droit = effacer · 8 périodes par jour</p>
            </div>
            <input id="studentSearch" type="search" placeholder="Rechercher un élève…" autocomplete="off" aria-label="Rechercher un élève">
        </div>
        <div class="filters">
            <button class="filter active" data-filter="all" type="button">Tous</button>
            <button class="filter" data-filter="risk" type="button">À risque</button>
            <button class="filter" data-filter="committed" type="button">Assidus</button>
        </div>
        <div class="table-scroll">
            <table id="attendanceTable">
                <thead id="attendanceHead"></thead>
                <tbody id="attendanceBody"></tbody>
            </table>
        </div>
    </section>

    <section class="panel hidden" data-panel="students">
        <div class="panel-head"><div><h1>Élèves de la classe</h1><p id="studentCount">0 élève</p></div><button class="btn success" id="addStudentBtn" type="button">+ Élève</button></div>
        <div class="students-list" id="studentsList"></div>
    </section>

    <section class="panel hidden" data-panel="statistics">
        <div class="panel-head"><div><h1>Statistiques mensuelles</h1><p>Les indicateurs sont calculés depuis MySQL.</p></div></div>
        <div class="statistics-grid" id="statisticsGrid"></div>
    </section>

    <section class="panel hidden" data-panel="archive">
        <div class="panel-head">
            <div><h1>Archive historique</h1><p>Lecture des classes et présences historiques.</p></div>
            <div class="toolbar-left">
                <label>Mois<input id="archiveMonth" type="month" aria-label="Mois archive"></label>
                <button class="btn primary" id="loadArchiveBtn" type="button">Charger</button>
            </div>
        </div>
        <div class="filters">
            <button class="filter active" data-archive-view="days" type="button">Jours</button>
            <button class="filter" data-archive-view="month" type="button">Élèves</button>
        </div>
        <div class="table-scroll"><table id="archiveTable"><thead></thead><tbody></tbody></table></div>
    </section>

    <section class="panel hidden admin-only" data-panel="admin">
        <div class="panel-head">
            <div><h1>Administration</h1><p>Gestion fonctionnelle du périmètre SAMS.</p></div>
        </div>

        <div class="students-list">
            <article class="student-card">
                <div>
                    <strong>Créer un utilisateur</strong>
                    <small>Admin, enseignant ou conseiller.</small>
                </div>
            </article>
            <form id="userForm">
                <label>Nom utilisateur<input id="userUsernameInput" required maxlength="50"></label>
                <label>Nom complet<input id="userFullNameInput" required maxlength="120"></label>
                <label>Rôle<select id="userRoleInput"><option value="teacher">teacher</option><option value="counselor">counselor</option><option value="admin">admin</option></select></label>
                <label>Mot de passe<input id="userPasswordInput" type="password" required></label>
                <button class="btn success" type="submit">Créer</button>
            </form>
        </div>

        <div class="students-list">
            <article class="student-card">
                <div>
                    <strong>Années scolaires</strong>
                    <small>Une seule année active à la fois.</small>
                </div>
            </article>
            <form id="academicYearForm">
                <label>Nom<input id="academicYearNameInput" required maxlength="20" placeholder="2026/2027"></label>
                <label>Début<input id="academicYearStartInput" type="date" required></label>
                <label>Fin<input id="academicYearEndInput" type="date" required></label>
                <label>Activer<select id="academicYearActivateInput"><option value="1">Oui</option><option value="0">Non</option></select></label>
                <button class="btn success" type="submit">Créer</button>
            </form>
        </div>

        <div class="students-list">
            <article class="student-card">
                <div>
                    <strong>Affectation enseignant → classe</strong>
                    <small>Les enseignants ne voient que leurs classes opérationnelles.</small>
                </div>
            </article>
            <form id="assignmentForm">
                <label>Enseignant<select id="assignmentTeacherInput"></select></label>
                <label>Classe<select id="assignmentClassInput"></select></label>
                <button class="btn primary" type="submit">Affecter</button>
            </form>
            <div class="table-scroll"><table id="usersTable"><thead></thead><tbody></tbody></table></div>
        </div>

        <div class="students-list">
            <article class="student-card">
                <div>
                    <strong>Import élèves CSV</strong>
                    <small>Validation puis import transactionnel.</small>
                </div>
            </article>
            <form id="importForm">
                <label>Fichier CSV<input id="studentImportFile" type="file" accept=".csv,text/csv" required></label>
                <button class="btn primary" type="submit">Analyser / staging</button>
            </form>
            <div class="table-scroll"><table id="importsTable"><thead></thead><tbody></tbody></table></div>
        </div>

        <div class="students-list">
            <article class="student-card">
                <div>
                    <strong>Activité / audit</strong>
                    <small>Dernières actions enregistrées.</small>
                </div>
            </article>
            <div class="table-scroll"><table id="auditTable"><thead></thead><tbody></tbody></table></div>
        </div>
    </section>

    <section class="panel hidden" data-panel="signature">
        <div class="panel-head"><div><h1>Signature de l'enseignant</h1><p>La signature est conservée pour la classe active.</p></div></div>
        <div class="signature-panel">
            <canvas id="signatureCanvas" width="900" height="320" aria-label="Zone de signature"></canvas>
            <div class="signature-actions">
                <button class="btn" id="clearSignatureBtn" type="button">Effacer</button>
                <button class="btn primary" id="saveSignatureBtn" type="button">Enregistrer</button>
            </div>
        </div>
    </section>
</main>

<dialog id="studentDialog"><form id="studentForm">
    <h2>Ajouter un élève</h2>
    <label>Prénom<input id="firstNameInput" required maxlength="80"></label>
    <label>Nom<input id="lastNameInput" required maxlength="80"></label>
    <label>N° élève<input id="studentNumberInput" maxlength="30"></label>
    <div class="dialog-actions"><button class="btn" value="cancel" type="button" data-close-dialog="studentDialog">Annuler</button><button class="btn primary" id="saveStudentBtn" type="submit">Ajouter</button></div>
</form></dialog>

<dialog id="classDialog"><form id="classForm">
    <h2>Créer une classe</h2>
    <label>Nom<input id="classNameInput" required maxlength="100"></label>
    <label>Niveau<input id="classLevelInput" maxlength="50"></label>
    <label>Branche<input id="classBranchInput" maxlength="100"></label>
    <div class="dialog-actions"><button class="btn" type="button" data-close-dialog="classDialog">Annuler</button><button class="btn primary" id="saveClassBtn" type="submit">Créer</button></div>
</form></dialog>

<dialog id="reportDialog"><form id="reportForm">
    <h2>Quel rapport voulez-vous générer ?</h2>
    <button class="btn primary" id="officialReportBtn" type="button">Feuille officielle de présence</button>
    <button class="btn" id="annualReportBtn" type="button">Statistiques analytiques</button>
    <button class="btn" type="button" data-close-dialog="reportDialog">Annuler</button>
</form></dialog>

<div id="toast" class="toast" role="status" aria-live="polite"></div>
<script type="module" src="assets/js/app.js"></script>
</body>
</html>
