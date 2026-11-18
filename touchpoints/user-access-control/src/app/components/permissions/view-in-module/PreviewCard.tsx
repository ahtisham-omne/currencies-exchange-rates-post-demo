import type { PreviewData } from "./types";
import { ListingPreview } from "./previews/ListingPreview";
import { DetailPreview } from "./previews/DetailPreview";
import { SidebarNavPreview } from "./previews/SidebarNavPreview";
import { ActionsMenuPreview } from "./previews/ActionsMenuPreview";
import { MobilePreview } from "./previews/MobilePreview";

interface PreviewCardProps {
  previewData: PreviewData;
  isOn: boolean;
  path: string;
}

export function PreviewCard({ previewData, isOn, path }: PreviewCardProps) {
  return (
    <div className="rounded-[8px] bg-[#F8FAFB] border border-gray-200 p-4">
      {previewData.type === "listing" && (
        <ListingPreview data={previewData} isOn={isOn} path={path} />
      )}
      {previewData.type === "detail" && (
        <DetailPreview data={previewData} isOn={isOn} path={path} />
      )}
      {previewData.type === "sidebarNav" && (
        <SidebarNavPreview data={previewData} isOn={isOn} path={path} />
      )}
      {previewData.type === "actionsMenu" && (
        <ActionsMenuPreview data={previewData} isOn={isOn} path={path} />
      )}
      {previewData.type === "mobile" && (
        <MobilePreview data={previewData} isOn={isOn} path={path} />
      )}
    </div>
  );
}
