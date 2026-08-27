<?php
declare(strict_types=1);
namespace SAMS\Services;
final class ClassService{public function normalizeName(string $name):string{return trim(preg_replace('/\s+/u',' ',$name)??'');}}
