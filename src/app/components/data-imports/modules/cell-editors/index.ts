/* Loads every module's special cell editors into the registry. Each module
 * owns its own file; add one import per module. */
import "./categoriesEditors";
import "./itemLibraryEditors";
import "./partnersEditors";
import "./partnerGroupsEditors";
import "./physicalInventoryEditors";

export { getSpecialEditor } from "./registry";
