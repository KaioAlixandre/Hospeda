# Deploy da API com HTTPS (Caddy)

O aplicativo desktop resolve a URL da API nesta ordem:

1. `HOSPEDA_API_URL` (variável de ambiente — prioridade máxima)
2. Arquivo `api-settings.json` na pasta de dados do usuário
3. `http://localhost:3333` (padrão de desenvolvimento)

## Na VPS

1. Aponte um domínio (ex.: `api.seudominio.com.br`) para o IP da VPS.
2. Instale o [Caddy](https://caddyserver.com/) e use um Caddyfile simples:

```
api.seudominio.com.br {
  reverse_proxy 127.0.0.1:3333
}
```

O Caddy obtém e renova o certificado TLS sozinho.

3. No `docker-compose`, publique a API só no loopback (`127.0.0.1:3333:3333`)
   e bloqueie a porta 3333 no firewall. Deixe o Caddy na frente.
4. Defina `TRUST_PROXY=1` e, se quiser restringir origens web,
   `CORS_ORIGINS=` com as origens permitidas (o app Electron costuma não
   enviar `Origin` e continua aceito).

## Em cada máquina do hotel

1. Abra **Configurações → Servidor**.
2. Informe `https://api.seudominio.com.br` (sem barra no final).
3. Salve — o app recarrega e passa a usar o novo endereço.

Se `HOSPEDA_API_URL` estiver definida no atalho ou no ambiente, a aba Servidor
fica somente leitura até você remover a variável.
