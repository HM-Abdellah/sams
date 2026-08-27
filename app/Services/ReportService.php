<?php
declare(strict_types=1);
namespace SAMS\Services;
final class ReportService{public function weekEnd(string $start):string{$d=date_create($start);if(!$d)throw new \InvalidArgumentException('Invalid date');$d->modify('+5 days');return $d->format('Y-m-d');}}
