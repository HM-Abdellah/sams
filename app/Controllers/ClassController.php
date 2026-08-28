<?php
declare(strict_types=1);
namespace SAMS\Controllers;
use SAMS\Helpers\Validation;
final class ClassController{public function validateCreate(array $input):array{return['name'=>Validation::requiredString($input['name']??null,'name',100),'level'=>isset($input['level'])?trim((string)$input['level']):null,'branch'=>isset($input['branch'])?trim((string)$input['branch']):null];}}
