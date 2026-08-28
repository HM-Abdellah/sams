<?php
declare(strict_types=1);
namespace SAMS\Controllers;
final class SignatureController{public static function isValidDataUrl(string $value):bool{return (bool)preg_match('/^data:image\/(png|jpeg);base64,[A-Za-z0-9+\/]+=*$/',$value);}}
