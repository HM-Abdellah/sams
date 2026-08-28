<?php
declare(strict_types=1);
namespace SAMS\Controllers;
use SAMS\Helpers\Validation;
final class StudentController{public function validateCreate(array $input):array{return['first_name'=>Validation::requiredString($input['first_name']??null,'first_name',80),'last_name'=>Validation::requiredString($input['last_name']??null,'last_name',80),'student_number'=>isset($input['student_number'])&&trim((string)$input['student_number'])!==''?trim((string)$input['student_number']):null];}}
