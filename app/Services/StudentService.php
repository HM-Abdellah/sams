<?php
declare(strict_types=1);
namespace SAMS\Services;
final class StudentService{public function normalizeName(string $name):array{$p=preg_split('/\s+/u',trim($name),2);return ['first_name'=>$p[0]??'','last_name'=>$p[1]??''];}}
