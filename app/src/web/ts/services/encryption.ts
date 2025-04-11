import CryptoJS from 'crypto-js';

/**
 * Encrypts sensitive server authentication data using AES
 * @param authData Server authentication data
 * @param password User's password used as encryption key
 * @returns Encrypted string
 */
export const encryptAuthData = (authData: ServerAuthData, password: string): string => {
    const jsonStr = JSON.stringify(authData);
    return CryptoJS.AES.encrypt(jsonStr, password).toString();
};

/**
 * Decrypts server authentication data
 * @param encryptedData Encrypted authentication data
 * @param password User's password used as decryption key
 * @returns Decrypted server authentication data
 */
export const decryptAuthData = (encryptedData: string, password: string): ServerAuthData => {
    try {
        const bytes = CryptoJS.AES.decrypt(encryptedData, password);
        const decryptedStr = bytes.toString(CryptoJS.enc.Utf8);
        if (!decryptedStr) {
            throw new Error('Failed to decrypt data');
        }
        return JSON.parse(decryptedStr);
    } catch (error) {
        console.error('Error decrypting auth data:', error);
        throw new Error('Failed to decrypt authentication data');
    }
};

/**
 * Validates if the stored password can decrypt the data
 * @param encryptedData Encrypted test data
 * @param password Password to validate
 * @returns boolean indicating if password is valid
 */
export const validatePassword = (encryptedData: string, password: string): boolean => {
    try {
        const bytes = CryptoJS.AES.decrypt(encryptedData, password);
        return !!bytes.toString(CryptoJS.enc.Utf8);
    } catch {
        return false;
    }
}; 