import { Link } from "@tanstack/react-router";
import { ChevronDown, Settings2 } from "lucide-react";
import { MASTER_OPTIONS } from "@/lib/masters";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
export function MastersMenu() {
 return <DropdownMenu><DropdownMenuTrigger asChild><Button variant="secondary" size="sm"><Settings2 className="h-4 w-4"/>Masters<ChevronDown className="h-3 w-3"/></Button></DropdownMenuTrigger><DropdownMenuContent align="start">{MASTER_OPTIONS.map(([kind,label])=><DropdownMenuItem key={kind} asChild>{kind==="product"?<Link to="/admin/products">{label}</Link>:<Link to="/admin/masters" search={{kind}}>{label}</Link>}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>;
}
