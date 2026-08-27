<?php
declare(strict_types=1); namespace SAMS\Repositories; use SAMS\Helpers\Database; final class StudentRepository{public function forClass(int $classId):array{$q=Database::connection()->prepare("SELECT id,student_number,first_name,last_name,status FROM students WHERE class_id=? ORDER BY last_name,first_name");$q->execute([$classId]);return $q->fetchAll();}}
