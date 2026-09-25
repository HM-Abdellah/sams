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
<html lang="fr" dir="ltr">
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
        <div class="language-switcher" role="group" aria-label="Language"><button class="btn ghost language-btn" data-lang="fr" type="button">FR</button><button class="btn ghost language-btn" data-lang="ar" type="button">العربية</button><button class="btn ghost language-btn" data-lang="en" type="button">EN</button></div><button id="themeBtn" class="btn ghost" type="button" aria-label="Changer le thème">🌙</button>
        <button id="logoutBtn" class="btn danger" type="button" data-i18n="logout">Déconnexion</button>
    </div>
</header>

<main class="app-shell">
    <section class="toolbar" aria-label="Filtres principaux" data-i18n-aria="main_filters">
        <div class="toolbar-left">
            <label><span data-i18n="class">Classe</span><select id="classSelect" aria-label="Classe"></select></label>
            <label><span data-i18n="month">Mois</span><input id="monthSelect" type="month" aria-label="Mois"></label>
            <button id="reloadBtn" class="btn primary" type="button" data-i18n="refresh">Actualiser</button>
        </div>
        <div class="toolbar-right">
            <button id="addClassBtn" class="btn success admin-only" type="button" data-i18n="add_class">+ Classe</button>
            <button id="reportBtn" class="btn" type="button" data-i18n="report">Rapport</button>
        </div>
    </section>

    <section class="stats" aria-label="Statistiques">
        <article><span data-i18n="present_count">Présences</span><strong id="statPresent">0</strong></article>
        <article><span data-i18n="absent_count_label">Absences</span><strong id="statAbsent">0</strong></article>
        <article><span data-i18n="late_excused">Retards / excusés</span><strong id="statOther">0</strong></article>
        <article><span data-i18n="presence_rate">Taux de présence</span><strong id="statRate">0%</strong></article>
    </section>

    <nav class="tabs" aria-label="Navigation principale">
        <button class="tab active" data-tab="attendance" type="button" data-i18n="attendance">Présence</button>
        <button class="tab" data-tab="students" type="button" data-i18n="students">Élèves</button>
        <button class="tab" data-tab="statistics" type="button" data-i18n="statistics">Statistiques</button>
        <button class="tab" data-tab="signature" type="button" data-i18n="signature">Signature</button>
        <button class="tab" data-tab="archive" type="button" data-i18n="archive">Archive</button>
        <button class="tab admin-only" data-tab="teachers" type="button" data-i18n="teachers">Enseignants</button><button class="tab admin-only" data-tab="admin" type="button" data-i18n="administration">Administration</button>
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
        <section class="admin-dashboard">
            <div class="panel-head">
                <div>
                    <h1 data-i18n="school_dashboard">Tableau de bord de l’établissement</h1>
                    <p><span data-i18n="dashboard_as_of">الوضع الحالي لليوم</span> <strong id="dashboardDate">—</strong></p>
                </div>
                <button class="btn primary" id="refreshDashboardBtn" type="button" data-i18n="refresh">Actualiser</button>
            </div>

            <div class="dashboard-pulse-grid" id="dashboardPulse"></div>

            <div class="dashboard-two-column">
                <section class="dashboard-card">
                    <div class="dashboard-card-head"><h2 data-i18n="attention">À surveiller</h2><span id="dashboardAlertCount" class="dashboard-count">0</span></div>
                    <div id="dashboardAlerts" class="dashboard-list"></div>
                </section>
                <section class="dashboard-card">
                    <div class="dashboard-card-head"><h2 data-i18n="teacher_status">État des enseignants</h2><span data-i18n="recent">Temps réel</span></div>
                    <div id="dashboardTeachers" class="dashboard-list"></div>
                </section>
            </div>

            <section class="dashboard-card">
                <div class="dashboard-card-head">
                    <div><h2 data-i18n="branch_statistics">Statistiques par branche</h2><p data-i18n="branch_statistics_desc">Chaque branche reste séparée pour éviter de mélanger les filières.</p></div>
                </div>
                <div class="dashboard-branch-grid" id="dashboardBranchGrid"></div>
            </section>

            <section class="dashboard-card">
                <div class="dashboard-card-head">
                    <div><h2 data-i18n="class_statistics">Statistiques par classe</h2><p data-i18n="class_statistics_desc">Une ligne correspond à une classe précise dans l’année scolaire active.</p></div>
                </div>
                <div class="table-scroll"><table id="dashboardClassTable"><thead></thead><tbody></tbody></table></div>
            </section>

            <section class="dashboard-card">
                <div class="dashboard-card-head"><h2 data-i18n="attention_students">Élèves à surveiller</h2><span data-i18n="absence_threshold">Seuil d'absence configurable</span></div>
                <div class="table-scroll"><table id="dashboardStudentTable"><thead></thead><tbody></tbody></table></div>
            </section>

            <section class="dashboard-card">
                <div class="dashboard-card-head"><h2 data-i18n="recent_activity">Activité récente</h2></div>
                <div class="table-scroll"><table id="dashboardAuditTable"><thead></thead><tbody></tbody></table></div>
            </section>
        </section>
        <div class="panel-head">
            <div><h1>Administration</h1><p>Gestion fonctionnelle du périmètre SAMS.</p></div>
        </div>

        <div class="students-list">
            <article class="student-card">
                <div>
                    <strong data-i18n="create_user">Créer un utilisateur</strong>
                    <small data-i18n="user_types">Admin, enseignant ou conseiller.</small>
                </div>
            </article>
            <form id="userForm">
                <label><span data-i18n="username">Nom utilisateur</span><input id="userUsernameInput" required maxlength="50"></label>
                <label><span data-i18n="full_name">Nom complet</span><input id="userFullNameInput" required maxlength="120"></label>
                <label><span data-i18n="role">Rôle</span><select id="userRoleInput"><option value="teacher">teacher</option><option value="counselor">counselor</option><option value="admin">admin</option></select></label>
                <label><span data-i18n="password">Mot de passe</span><input id="userPasswordInput" type="password" required></label>
                <button class="btn success" type="submit" data-i18n="create">Créer</button>
            </form>
        </div>

        <div class="students-list">
            <article class="student-card">
                <div>
                    <strong data-i18n="school_years">Années scolaires</strong>
                    <small data-i18n="one_active_year">Une seule année active à la fois.</small>
                </div>
            </article>
            <form id="academicYearForm">
                <label><span data-i18n="name">Nom</span><input id="academicYearNameInput" required maxlength="20" placeholder="2026/2027"></label>
                <label><span data-i18n="start">Début</span><input id="academicYearStartInput" type="date" required></label>
                <label><span data-i18n="end">Fin</span><input id="academicYearEndInput" type="date" required></label>
                <label><span data-i18n="activate">Activer</span><select id="academicYearActivateInput"><option value="1" data-i18n="yes">Oui</option><option value="0" data-i18n="no">Non</option></select></label>
                <button class="btn success" type="submit" data-i18n="create">Créer</button>
            </form>
        </div>

        <div class="students-list">
            <article class="student-card">
                <div>
                    <strong data-i18n="teacher_class_assignment">Affectation enseignant → classe</strong>
                    <small data-i18n="teacher_class_assignment_desc">Les enseignants ne voient que leurs classes opérationnelles.</small>
                </div>
            </article>
            <form id="assignmentForm">
                <label><span data-i18n="teacher">Enseignant</span><select id="assignmentTeacherInput"></select></label>
                <label><span data-i18n="class">Classe</span><select id="assignmentClassInput"></select></label>
                <button class="btn primary" type="submit" data-i18n="assign">Affecter</button>
            </form>
            <div class="table-scroll"><table id="usersTable"><thead></thead><tbody></tbody></table></div>
        </div>

        <div class="students-list">
            <article class="student-card">
                <div>
                    <strong data-i18n="csv_import">Import élèves CSV</strong>
                    <small data-i18n="csv_import_desc">Validation puis import transactionnel.</small>
                </div>
            </article>
            <form id="importForm">
                <label><span data-i18n="file">Fichier CSV</span><input id="studentImportFile" type="file" accept=".csv,text/csv" required></label>
                <button class="btn primary" type="submit" data-i18n="analyze_staging">Analyser / staging</button>
            </form>
            <div class="table-scroll"><table id="importsTable"><thead></thead><tbody></tbody></table></div>
        </div>

        <div class="students-list">
            <article class="student-card">
                <div>
                    <strong data-i18n="activity_audit">Activité / audit</strong>
                    <small data-i18n="latest_actions">Dernières actions enregistrées.</small>
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

<dialog id="teacherEditDialog"><form id="teacherEditForm">
    <h2 data-i18n="edit_teacher">Modifier l’enseignant</h2>
    <input id="teacherEditId" type="hidden">
    <label><span data-i18n="employee_id">Matricule</span><input id="teacherEditEmployeeId" required maxlength="50"></label>
    <label><span data-i18n="full_name">Nom complet</span><input id="teacherEditFullName" required maxlength="120"></label>
    <label><span data-i18n="phone">Téléphone</span><input id="teacherEditPhone" maxlength="30" inputmode="tel"></label>
    <label><span data-i18n="account_active">Compte actif</span><select id="teacherEditActive"><option value="1" data-i18n="yes">Oui</option><option value="0" data-i18n="no">Non</option></select></label>
    <div class="dialog-actions"><button class="btn" type="button" data-close-dialog="teacherEditDialog" data-i18n="cancel">Annuler</button><button class="btn primary" type="submit" data-i18n="save">Enregistrer</button></div>
</form></dialog>

<dialog id="teachingDialog"><form id="teachingForm">
    <h2 data-i18n="assign_teaching">Affecter un enseignement</h2>
    <label><span data-i18n="teacher">Enseignant</span><select id="teachingTeacherId" required></select></label>
    <label><span data-i18n="subject">Matière</span><select id="teachingSubjectId" required></select></label>
    <label><span data-i18n="class">Classe</span><select id="teachingClassId" required></select></label>
    <div class="dialog-actions"><button class="btn" type="button" data-close-dialog="teachingDialog" data-i18n="cancel">Annuler</button><button class="btn primary" type="submit" data-i18n="assign">Affecter</button></div>
</form></dialog>

<dialog id="subjectDialog"><form id="subjectForm">
    <h2 data-i18n="new_subject">Nouvelle matière</h2>
    <label><span data-i18n="subject_code">Code</span><input id="subjectCodeInput" required maxlength="30" placeholder="MATH"></label>
    <label><span data-i18n="name_french">Nom français</span><input id="subjectNameFrInput" required maxlength="120"></label>
    <label><span data-i18n="name_arabic">Nom arabe</span><input id="subjectNameArInput" required maxlength="120" dir="rtl"></label>
    <label><span data-i18n="name_english">Nom anglais</span><input id="subjectNameEnInput" required maxlength="120"></label>
    <div class="dialog-actions"><button class="btn" type="button" data-close-dialog="subjectDialog" data-i18n="cancel">Annuler</button><button class="btn primary" type="submit" data-i18n="create">Créer</button></div>
</form></dialog>

<dialog id="studentDialog"><form id="studentForm">
    <h2>Ajouter un élève</h2>
    <label>Prénom<input id="firstNameInput" required maxlength="80"></label>
    <label>Nom<input id="lastNameInput" required maxlength="80"></label>
    <label>Massar<input id="massarInput" maxlength="32"></label>
    <label>Date de naissance<input id="birthDateInput" type="date"></label>
    <label>N° élève<input id="studentNumberInput" maxlength="30"></label>
    <div class="dialog-actions"><button class="btn" value="cancel" type="button" data-close-dialog="studentDialog">Annuler</button><button class="btn primary" id="saveStudentBtn" type="submit">Ajouter</button></div>
</form></dialog>

<dialog id="editStudentDialog"><form id="editStudentForm">
    <h2>Modifier un élève</h2>
    <input id="editStudentId" type="hidden">
    <label>Prénom<input id="editFirstNameInput" required maxlength="80"></label>
    <label>Nom<input id="editLastNameInput" required maxlength="80"></label>
    <label>Massar<input id="editMassarInput" maxlength="32"></label>
    <label>Date de naissance<input id="editBirthDateInput" type="date"></label>
    <label>N° élève<input id="editStudentNumberInput" maxlength="30"></label>
    <div class="dialog-actions"><button class="btn" type="button" data-close-dialog="editStudentDialog">Annuler</button><button class="btn primary" type="submit">Enregistrer</button></div>
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
