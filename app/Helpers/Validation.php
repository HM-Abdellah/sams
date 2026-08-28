<?php
declare(strict_types=1);
namespace SAMS\Helpers;

final class Validation
{
    public static function requiredString(mixed $value,string $field,int $max=255):string{if(!is_string($value))Response::error("$field is required.",422);$v=trim($value);if($v===''||mb_strlen($v)>$max)Response::error("Invalid $field.",422);return $v;}
    public static function id(mixed $value,string $field):int{$id=filter_var($value,FILTER_VALIDATE_INT,['options'=>['min_range'=>1]]);if($id===false)Response::error("Invalid $field.",422);return(int)$id;}
    public static function date(mixed $value,string $field):string{$v=is_string($value)?$value:'';$d=\DateTimeImmutable::createFromFormat('!Y-m-d',$v);if(!$d||$d->format('Y-m-d')!==$v)Response::error("Invalid $field.",422);return$v;}
    public static function enum(mixed $value,string $field,array $allowed):string{$v=is_string($value)?$value:'';if(!in_array($v,$allowed,true))Response::error("Invalid $field.",422);return$v;}
}
