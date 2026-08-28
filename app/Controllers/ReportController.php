<?php
declare(strict_types=1);
namespace SAMS\Controllers;
use SAMS\Helpers\Validation;
final class ReportController{public function validate(array $input):array{$month=(string)($input['month']??'');if(!preg_match('/^\d{4}-(0[1-9]|1[0-2])$/',$month))throw new \InvalidArgumentException('Invalid report month.');return['class_id'=>Validation::id($input['class_id']??null,'class_id'),'month'=>$month];}}
