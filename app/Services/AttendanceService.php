<?php
declare(strict_types=1);
namespace SAMS\Services;
final class AttendanceService{public const STATUSES=['present','absent','late','excused'];public function validStatus(string $status):bool{return in_array($status,self::STATUSES,true);}}
