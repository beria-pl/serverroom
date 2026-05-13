from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Serverroom Visualizer"
    jwt_secret: str = "change-me"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60

    database_url: str = "postgresql+psycopg2://serverroom:serverroom@postgres:5432/serverroom"

    ldap_enabled: bool = True
    ldap_server_uri: str = "ldap://openldap:389"
    ldap_domain: str = "example.com"
    ldap_base_dn: str = "dc=example,dc=com"
    totp_issuer: str = "Serverroom Visualizer"
    bootstrap_admin_username: str = "admin"
    bootstrap_admin_password: str = "admin12345"


settings = Settings()
