<?php
declare(strict_types=1);
namespace SAMS\Services;
final class SignatureService{public function validDataUrl(string $data):bool{return (bool)preg_match('#^data:image/png;base64,[A-Za-z0-9+/=]+$#',$data);}}
