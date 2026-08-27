<?php
declare(strict_types=1);
session_start();
header('Content-Type: text/html; charset=UTF-8');
if (empty($_SESSION['user'])) { header('Location: login.php', true, 302); exit; }
$user = $_SESSION['user'];
?>
<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#0d1117"><title>SAMS — نظام الغياب</title>
<link rel="stylesheet" href="assets/css/style.css">
</head>
<body>
<header class="topbar"><div class="brand"><span class="brand-icon">🏫</span><div><strong>SAMS</strong><small>نظام الغياب المدرسي</small></div></div><div class="user-area"><span><?= htmlspecialchars((string)$user['full_name'], ENT_QUOTES, 'UTF-8') ?></span><button id="logoutBtn" class="btn ghost">تسجيل الخروج</button></div></header>
<main class="app-shell">
<section class="toolbar"><div class="toolbar-left"><label>القسم <select id="classSelect"></select></label><label>بداية الأسبوع <input id="weekStart" type="date"></label></div><div class="toolbar-right"><button id="addClassBtn" class="btn primary">+ قسم</button><button id="addStudentBtn" class="btn success">+ تلميذ</button><button id="refreshBtn" class="btn">تحديث</button></div></section>
<section class="stats"><article><span>التلاميذ</span><strong id="studentsCount">0</strong></article><article><span>الغياب</span><strong id="absenceCount">0</strong></article><article><span>الحضور</span><strong id="presentCount">0</strong></article><article><span>النسبة</span><strong id="attendanceRate">0%</strong></article></section>
<nav class="tabs"><button class="tab active" data-tab="attendance">الغياب</button><button class="tab" data-tab="students">التلاميذ</button><button class="tab" data-tab="statistics">الإحصاء</button></nav>
<section class="panel" data-panel="attendance"><div class="panel-head"><div><h1>جدول الغياب</h1><p>اضغط على الخلية لتسجيل حضور أو غياب الحصة.</p></div></div><div class="table-scroll"><table id="attendanceTable"><thead><tr id="attendanceHead"><th class="sticky">التلميذ</th></tr></thead><tbody id="attendanceBody"></tbody></table></div></section>
<section class="panel hidden" data-panel="students"><div class="panel-head"><h1>التلاميذ</h1><p>إدارة القسم النشط.</p></div><div id="studentsList" class="students-list"></div></section>
<section class="panel hidden" data-panel="statistics"><div class="panel-head"><h1>الإحصاء</h1><p>ملخص بيانات القسم النشط.</p></div><div id="statisticsContent" class="statistics-grid"></div></section>
</main>
<dialog id="classDialog"><form method="dialog" id="classForm"><h2>إضافة قسم</h2><input id="className" maxlength="100" required placeholder="مثال: 1BACSMF"><div class="dialog-actions"><button value="cancel" class="btn">إلغاء</button><button value="default" class="btn primary">حفظ</button></div></form></dialog>
<dialog id="studentDialog"><form method="dialog" id="studentForm"><h2>إضافة تلميذ</h2><input id="studentName" maxlength="120" required placeholder="الاسم الكامل"><div class="dialog-actions"><button value="cancel" class="btn">إلغاء</button><button value="default" class="btn success">حفظ</button></div></form></dialog>
<div id="toast" class="toast" role="status" aria-live="polite"></div>
<script type="module" src="assets/js/app.js"></script>
</body></html>
