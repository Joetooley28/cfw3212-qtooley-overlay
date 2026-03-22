objHandler = {
  authenticatedOnly=true,
  readGroups={root=true,admin=true},
  writeGroups={root=true,admin=true},
  get=function(authenticated, requestHandler)
    return {
      currentUser = requestHandler.session.user or "",
      testedFirmware = "USC_1.1.79.0 / RG520NNADAR03A03M4G",
      statusText = "Placeholder page ready for future tool work."
    }
  end,
  validate=function(o, requestHandler)
    return true
  end,
  set=function(authenticated, o, requestHandler)
    return 0
  end
}
