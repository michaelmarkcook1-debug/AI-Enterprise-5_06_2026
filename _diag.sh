#!/usr/bin/env bash
# Char-category diagnostic — never prints values.
sed -n '4p' .env.local | awk '{
  n=length($0); alnum=0; dq=0; sq=0; eq=0; dash=0; under=0; bs=0; space=0; dot=0; colon=0; slash=0
  for (i=1; i<=n; i++) {
    c=substr($0,i,1)
    if (match(c,/[a-zA-Z0-9]/)) alnum++
    else if (c=="\"") dq++
    else if (c=="\047") sq++
    else if (c=="=") eq++
    else if (c=="-") dash++
    else if (c=="_") under++
    else if (c=="\\") bs++
    else if (c==" ") space++
    else if (c==".") dot++
    else if (c==":") colon++
    else if (c=="/") slash++
  }
  other = n - alnum - dq - sq - eq - dash - under - bs - space - dot - colon - slash
  printf "  total bytes : %d\n  alphanumeric: %d\n  double-quote: %d\n  single-quote: %d\n  equals      : %d\n  dash        : %d\n  underscore  : %d\n  backslash   : %d\n  spaces      : %d\n  dot         : %d\n  colon       : %d\n  slash       : %d\n  other       : %d\n", n, alnum, dq, sq, eq, dash, under, bs, space, dot, colon, slash, other
}'
