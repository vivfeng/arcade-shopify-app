import {
  type LoginError,
  LoginErrorType,
} from "@shopify/shopify-app-remix/server";

export function loginErrorMessage(loginErrors: LoginError) {
  if (loginErrors?.shop === LoginErrorType.MissingShop) {
    return "Please enter your store's domain to log in.";
  }
  return "Please enter a valid store domain to log in.";
}
