/** Public, import-safe facade for the new lineage catalogue.
 * Source of truth lives in the dependency-free microscope model, so legacy
 * offline tests can load it without a CommonJS require function.
 */
export {
 BIO_NEW_IDS,
 BIO_NEW_CHAINS,
 BIO_NEW_SOURCES,
 BIO_NEW_ROOT_POINTS,
 isBioNewOrganism,
 bioNewCellFeatures
} from "./lektrusBioMicroscopeModel";
export type {BioNewOrganism,BioNewChain} from "./lektrusBioMicroscopeModel";
